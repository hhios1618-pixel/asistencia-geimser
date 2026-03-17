import type { Tables } from '../../types/database';
import { runQuery } from '../db/postgres';
import { ensureTrainingTables } from '../db/ensureTrainingAndBlacklistTables';

type AsistenciaRole = Tables['people']['Row']['role'];

type TrainingCampaign = {
  campaign_id: string;
  name: string;
  status: string | null;
  channel: string | null;
  source: string | null;
};

const DEFAULT_CAMPAIGN_STATUS = 'active';

let profilesTableExistsPromise: Promise<boolean> | null = null;
let campaignsTableExistsPromise: Promise<boolean> | null = null;
let campaignMembersTableExistsPromise: Promise<boolean> | null = null;

const tableExists = async (qualifiedTableName: string): Promise<boolean> => {
  const { rows } = await runQuery<{ exists: boolean }>(
    `select to_regclass($1) is not null as exists`,
    [qualifiedTableName]
  );
  return Boolean(rows[0]?.exists);
};

const hasProfilesTable = async (): Promise<boolean> => {
  if (!profilesTableExistsPromise) {
    profilesTableExistsPromise = tableExists('public.profiles').catch(() => {
      profilesTableExistsPromise = null;
      return false;
    });
  }
  return profilesTableExistsPromise;
};

const hasCampaignsTable = async (): Promise<boolean> => {
  if (!campaignsTableExistsPromise) {
    campaignsTableExistsPromise = tableExists('public.campaigns').catch(() => {
      campaignsTableExistsPromise = null;
      return false;
    });
  }
  return campaignsTableExistsPromise;
};

const hasCampaignMembersTable = async (): Promise<boolean> => {
  if (!campaignMembersTableExistsPromise) {
    campaignMembersTableExistsPromise = tableExists('public.campaign_members').catch(() => {
      campaignMembersTableExistsPromise = null;
      return false;
    });
  }
  return campaignMembersTableExistsPromise;
};

export const mapCrmRoleToAsistenciaRole = (crmRole: string | null | undefined): AsistenciaRole | null => {
  const normalized = (crmRole ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'admin') return 'ADMIN';
  if (normalized === 'supervisor') return 'SUPERVISOR';
  if (normalized === 'agent') return 'WORKER';
  if (normalized === 'analytics_viewer') return 'SUPERVISOR';
  return null;
};

export const resolveCrmRoleFromProfile = async (userId: string): Promise<AsistenciaRole | null> => {
  try {
    if (!(await hasProfilesTable())) {
      return null;
    }

    const { rows } = await runQuery<{ role: string | null }>(
      `select role::text as role
       from public.profiles
       where user_id = $1
       limit 1`,
      [userId]
    );

    return mapCrmRoleToAsistenciaRole(rows[0]?.role ?? null);
  } catch {
    return null;
  }
};

export const isTrainingManager = (role: AsistenciaRole) => role === 'ADMIN' || role === 'SUPERVISOR';

export const syncTrainingCampaignCatalogFromCrm = async () => {
  await ensureTrainingTables();

  if (!(await hasCampaignsTable())) {
    return { synced: 0, source: 'local' as const };
  }

  let rows: Array<{
    campaign_id: string;
    name: string | null;
    status: string | null;
    channel: string | null;
  }> = [];

  try {
    const result = await runQuery<{
      campaign_id: string;
      name: string | null;
      status: string | null;
      channel: string | null;
    }>(
      `select
         id::text as campaign_id,
         name,
         status,
         campaign_channel::text as channel
       from public.campaigns
       where id is not null
       order by created_at desc
       limit 3000`
    );
    rows = result.rows;
  } catch {
    const result = await runQuery<{
      campaign_id: string;
      name: string | null;
      status: string | null;
      channel: string | null;
    }>(
      `select
         id::text as campaign_id,
         name,
         status,
         null::text as channel
       from public.campaigns
       where id is not null
       order by created_at desc
       limit 3000`
    );
    rows = result.rows;
  }

  if (rows.length === 0) {
    return { synced: 0, source: 'crm' as const };
  }

  for (const campaign of rows) {
    const campaignId = (campaign.campaign_id ?? '').trim();
    const name = (campaign.name ?? '').trim();
    if (!campaignId || !name) continue;

    await runQuery(
      `insert into public.training_campaigns (
        campaign_id,
        name,
        status,
        channel,
        source,
        last_synced_at,
        updated_at
      ) values ($1, $2, $3, $4, 'crm', now(), now())
      on conflict (campaign_id) do update set
        name = excluded.name,
        status = excluded.status,
        channel = excluded.channel,
        source = 'crm',
        last_synced_at = now(),
        updated_at = now()`,
      [campaignId, name, campaign.status ?? DEFAULT_CAMPAIGN_STATUS, campaign.channel ?? null]
    );
  }

  return { synced: rows.length, source: 'crm' as const };
};

const getCampaignMembershipIds = async (userId: string): Promise<Set<string>> => {
  if (!(await hasCampaignMembersTable())) {
    return new Set<string>();
  }

  const { rows } = await runQuery<{ campaign_id: string }>(
    `select campaign_id::text as campaign_id
     from public.campaign_members
     where user_id = $1`,
    [userId]
  );

  return new Set(rows.map((row) => String(row.campaign_id ?? '').trim()).filter(Boolean));
};

export const listTrainingCampaignsForUser = async (userId: string, role: AsistenciaRole): Promise<TrainingCampaign[]> => {
  await ensureTrainingTables();
  await syncTrainingCampaignCatalogFromCrm();

  if (role === 'ADMIN') {
    const { rows } = await runQuery<TrainingCampaign>(
      `select campaign_id, name, status, channel, source
       from public.training_campaigns
       order by name asc`
    );
    return rows;
  }

  const memberCampaignIds = await getCampaignMembershipIds(userId);
  if (memberCampaignIds.size > 0) {
    const { rows } = await runQuery<TrainingCampaign>(
      `select campaign_id, name, status, channel, source
       from public.training_campaigns
       where campaign_id = any($1::text[])
       order by name asc`,
      [Array.from(memberCampaignIds)]
    );
    return rows;
  }

  // If no campaign membership exists in this environment, fallback to active catalog.
  if (!(await hasCampaignMembersTable())) {
    const { rows } = await runQuery<TrainingCampaign>(
      `select campaign_id, name, status, channel, source
       from public.training_campaigns
       where coalesce(status, $1) = $1
       order by name asc`,
      [DEFAULT_CAMPAIGN_STATUS]
    );
    return rows;
  }

  return [];
};

export const canUserAccessTrainingCampaign = async (
  userId: string,
  role: AsistenciaRole,
  campaignId: string
): Promise<boolean> => {
  const normalized = campaignId.trim();
  if (!normalized) return false;

  if (role === 'ADMIN') {
    const { rows } = await runQuery<{ exists: boolean }>(
      `select exists(
         select 1
         from public.training_campaigns
         where campaign_id = $1
       ) as exists`,
      [normalized]
    );
    return Boolean(rows[0]?.exists);
  }

  if (!(await hasCampaignMembersTable())) {
    return true;
  }

  const { rows } = await runQuery<{ exists: boolean }>(
    `select exists(
       select 1
       from public.campaign_members
       where user_id = $1
         and campaign_id::text = $2
     ) as exists`,
    [userId, normalized]
  );

  return Boolean(rows[0]?.exists);
};
