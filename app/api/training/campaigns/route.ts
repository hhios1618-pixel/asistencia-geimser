import { NextResponse } from 'next/server';
import { getTrainingAuthContext, canManageTraining } from '../_shared';
import { listTrainingCampaignsForUser, syncTrainingCampaignCatalogFromCrm } from '../../../../lib/integrations/registroIntel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const ctx = await getTrainingAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const campaigns = await listTrainingCampaignsForUser(ctx.user.id, ctx.role);

  return NextResponse.json(
    {
      items: campaigns,
      can_manage: canManageTraining(ctx.role),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST() {
  const ctx = await getTrainingAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!canManageTraining(ctx.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await syncTrainingCampaignCatalogFromCrm();
  const campaigns = await listTrainingCampaignsForUser(ctx.user.id, ctx.role);

  return NextResponse.json({
    ok: true,
    synced: result.synced,
    source: result.source,
    items: campaigns,
  });
}
