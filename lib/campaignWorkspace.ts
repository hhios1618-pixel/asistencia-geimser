import 'server-only';

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import { runQuery } from '@/lib/db/postgres';
import { getServiceSupabase } from '@/lib/supabase/server';
import { writeAuditTrail } from '@/lib/audit/log';

export type WorkspaceActor = {
  id: string;
  role: string;
  campaignId: string | null;
  hasClientAccess: boolean;
  canManageCampaign: boolean;
  canManageOwnFolder: boolean;
  canReadWorkspace: boolean;
  canDownloadClientFiles: boolean;
};

type ActorRow = {
  id: string;
  role: string;
  campaign_id: string | null;
  has_client_access: boolean;
  client_access_level: string | null;
  supervisor_has_campaign_access: boolean;
};

export const WORKSPACE_DOC_TYPE = 'WORKSPACE';

export async function getWorkspaceActor(userId: string, campaignId: string): Promise<WorkspaceActor | null> {
  const { rows: [row] } = await runQuery<ActorRow>(
    `
      select
        p.id,
        p.role,
        p.campaign_id::text,
        exists (
          select 1
          from campaign_client_access cca
          where cca.campaign_id = $2::uuid
            and cca.person_id = p.id
            and cca.is_active = true
            and (cca.expires_at is null or cca.expires_at > now())
        ) as has_client_access,
        (
          select cca.access_level
          from campaign_client_access cca
          where cca.campaign_id = $2::uuid
            and cca.person_id = p.id
            and cca.is_active = true
            and (cca.expires_at is null or cca.expires_at > now())
          order by cca.created_at desc
          limit 1
        ) as client_access_level,
        exists (
          select 1
          from people current_person
          where current_person.id = p.id
            and current_person.role = 'SUPERVISOR'
            and (
              current_person.campaign_id = $2::uuid
              or exists (
                select 1
                from team_assignments ta
                join people worker on worker.id = ta.member_id
                where ta.supervisor_id = p.id
                  and ta.active = true
                  and worker.campaign_id = $2::uuid
              )
            )
        ) as supervisor_has_campaign_access
      from people p
      where p.id = $1::uuid
        and p.is_active = true
      limit 1
    `,
    [userId, campaignId]
  );

  if (!row) {
    return null;
  }

  const isAdmin = row.role === 'ADMIN';
  const isSupervisor = row.role === 'SUPERVISOR' && row.supervisor_has_campaign_access;
  const isWorker = row.role === 'WORKER' && row.campaign_id === campaignId;
  const isClient = row.role === 'CLIENT' && row.has_client_access;

  return {
    id: row.id,
    role: row.role,
    campaignId: row.campaign_id,
    hasClientAccess: row.has_client_access,
    canManageCampaign: isAdmin || isSupervisor,
    canManageOwnFolder: isWorker,
    canReadWorkspace: isAdmin || isSupervisor || isWorker || isClient,
    canDownloadClientFiles: row.client_access_level === 'DOWNLOAD',
  };
}

export const sanitizeFileName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 160) || 'archivo';

export const buildWorkspaceStoragePath = (campaignId: string, personId: string, fileName: string) =>
  `${campaignId}/workspace/${personId}/${Date.now()}_${sanitizeFileName(fileName)}`;

export function getRequestMetadata(request: NextRequest) {
  const ipHeader = request.headers.get('x-forwarded-for');
  return {
    ip: ipHeader?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
  };
}

export async function registerWorkspaceAudit(params: {
  actorId: string | null;
  action: string;
  entityId: string | null;
  before?: Json | null;
  after?: Json | null;
  ip?: string | null;
  userAgent?: string | null;
  supabase?: SupabaseClient<Database, 'public'>;
}) {
  const supabase = params.supabase ?? getServiceSupabase();
  await writeAuditTrail(supabase, {
    actorId: params.actorId,
    action: params.action,
    entity: 'campaign_workspace_file',
    entityId: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
  });
}
