import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runQuery } from '../../../../lib/db/postgres';
import { ensureTrainingTables } from '../../../../lib/db/ensureTrainingAndBlacklistTables';
import { canUserAccessTrainingCampaign } from '../../../../lib/integrations/registroIntel';
import { getServiceSupabase } from '../../../../lib/supabase/server';
import { canManageTraining, getTrainingAuthContext } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createResourceSchema = z.object({
  campaignId: z.string().min(1),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(1000).optional().nullable(),
  url: z.string().trim().url(),
  type: z.enum(['youtube', 'link']).optional(),
});

const isYoutubeUrl = (value: string) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return host.includes('youtube.com') || host.includes('youtu.be');
  } catch {
    return false;
  }
};

export async function GET(request: NextRequest) {
  const ctx = await getTrainingAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const campaignId = (request.nextUrl.searchParams.get('campaignId') ?? '').trim();
  if (!campaignId) {
    return NextResponse.json({ error: 'CAMPAIGN_REQUIRED' }, { status: 400 });
  }

  await ensureTrainingTables();

  const canAccess = await canUserAccessTrainingCampaign(ctx.user.id, ctx.role, campaignId);
  if (!canAccess) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { rows } = await runQuery<{
    id: string;
    campaign_id: string;
    title: string;
    description: string | null;
    resource_type: 'youtube' | 'link' | 'file';
    url: string | null;
    storage_bucket: string | null;
    storage_path: string | null;
    uploaded_by: string | null;
    uploaded_by_name: string | null;
    created_at: string;
  }>(
    `select
       id::text as id,
       campaign_id,
       title,
       description,
       resource_type,
       url,
       storage_bucket,
       storage_path,
       uploaded_by::text as uploaded_by,
       uploaded_by_name,
       created_at::text as created_at
     from public.training_resources
     where campaign_id = $1
     order by created_at desc`,
    [campaignId]
  );

  const service = getServiceSupabase();
  const items = await Promise.all(
    rows.map(async (resource) => {
      if (resource.resource_type !== 'file' || !resource.storage_bucket || !resource.storage_path) {
        return resource;
      }
      const signed = await service.storage
        .from(resource.storage_bucket)
        .createSignedUrl(resource.storage_path, 60 * 60);

      return {
        ...resource,
        url: signed.data?.signedUrl ?? resource.url,
      };
    })
  );

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const ctx = await getTrainingAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!canManageTraining(ctx.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createResourceSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  await ensureTrainingTables();

  const campaignId = parsed.data.campaignId.trim();
  const canAccess = await canUserAccessTrainingCampaign(ctx.user.id, ctx.role, campaignId);
  if (!canAccess && ctx.role !== 'ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const type = parsed.data.type ?? (isYoutubeUrl(parsed.data.url) ? 'youtube' : 'link');

  await runQuery(
    `insert into public.training_resources (
       id,
       campaign_id,
       title,
       description,
       resource_type,
       url,
       uploaded_by,
       uploaded_by_name,
       created_at,
       updated_at
     ) values ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8, now(), now())`,
    [
      crypto.randomUUID(),
      campaignId,
      parsed.data.title.trim(),
      (parsed.data.description ?? '').trim() || null,
      type,
      parsed.data.url,
      ctx.user.id,
      ctx.displayName,
    ]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getTrainingAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!canManageTraining(ctx.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const id = (request.nextUrl.searchParams.get('id') ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 400 });
  }

  await ensureTrainingTables();

  const { rows } = await runQuery<{
    id: string;
    campaign_id: string;
    resource_type: 'youtube' | 'link' | 'file';
    storage_bucket: string | null;
    storage_path: string | null;
  }>(
    `select
       id::text as id,
       campaign_id,
       resource_type,
       storage_bucket,
       storage_path
     from public.training_resources
     where id = $1::uuid
     limit 1`,
    [id]
  );

  const item = rows[0] ?? null;
  if (!item) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const canAccessCampaign = await canUserAccessTrainingCampaign(ctx.user.id, ctx.role, item.campaign_id);
  if (!canAccessCampaign && ctx.role !== 'ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  await runQuery(`delete from public.training_resources where id = $1::uuid`, [id]);

  if (item.resource_type === 'file' && item.storage_bucket && item.storage_path) {
    const service = getServiceSupabase();
    await service.storage.from(item.storage_bucket).remove([item.storage_path]);
  }

  return NextResponse.json({ ok: true });
}
