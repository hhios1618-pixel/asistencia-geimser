import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '../../../../../lib/db/postgres';
import { ensureTrainingTables } from '../../../../../lib/db/ensureTrainingAndBlacklistTables';
import { canUserAccessTrainingCampaign } from '../../../../../lib/integrations/registroIntel';
import { getServiceSupabase } from '../../../../../lib/supabase/server';
import { canManageTraining, getTrainingAuthContext } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_BUCKET = process.env.SUPABASE_TRAINING_BUCKET ?? 'training-assets';
const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;

const allowedExtensions = new Set([
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'csv',
  'mp4',
]);

const safeFileName = (rawName: string) => {
  const normalized = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || `archivo-${Date.now()}`;
};

const extensionOf = (fileName: string) => {
  const segments = fileName.toLowerCase().split('.');
  return segments.length > 1 ? segments[segments.length - 1] ?? '' : '';
};

const ensureBucketExists = async (bucket: string) => {
  const service = getServiceSupabase();
  const listed = await service.storage.listBuckets();
  if (listed.error) {
    throw new Error(listed.error.message);
  }
  const exists = (listed.data ?? []).some((item) => item.name === bucket);
  if (exists) return;

  const created = await service.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
  });
  if (created.error) {
    throw new Error(created.error.message);
  }
};

export async function POST(request: NextRequest) {
  const ctx = await getTrainingAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!canManageTraining(ctx.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 });
  }

  const file = form.get('file');
  const campaignId = String(form.get('campaignId') ?? '').trim();
  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
  }

  if (!campaignId) {
    return NextResponse.json({ error: 'CAMPAIGN_REQUIRED' }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'INVALID_FILE_SIZE' }, { status: 400 });
  }

  const sanitizedName = safeFileName(file.name);
  const extension = extensionOf(sanitizedName);
  if (!allowedExtensions.has(extension)) {
    return NextResponse.json({ error: 'UNSUPPORTED_FILE_TYPE' }, { status: 400 });
  }

  const canAccess = await canUserAccessTrainingCampaign(ctx.user.id, ctx.role, campaignId);
  if (!canAccess && ctx.role !== 'ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  await ensureTrainingTables();
  await ensureBucketExists(DEFAULT_BUCKET);

  const folderSafeCampaignId = campaignId.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const storagePath = `${folderSafeCampaignId}/${Date.now()}-${crypto.randomUUID()}-${sanitizedName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const service = getServiceSupabase();
  const upload = await service.storage.from(DEFAULT_BUCKET).upload(storagePath, buffer, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (upload.error) {
    return NextResponse.json({ error: 'UPLOAD_FAILED', message: upload.error.message }, { status: 500 });
  }

  await runQuery(
    `insert into public.training_resources (
       id,
       campaign_id,
       title,
       description,
       resource_type,
       url,
       storage_bucket,
       storage_path,
       uploaded_by,
       uploaded_by_name,
       created_at,
       updated_at
     ) values ($1::uuid, $2, $3, $4, 'file', null, $5, $6, $7::uuid, $8, now(), now())`,
    [
      crypto.randomUUID(),
      campaignId,
      title || file.name,
      description || null,
      DEFAULT_BUCKET,
      storagePath,
      ctx.user.id,
      ctx.displayName,
    ]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
