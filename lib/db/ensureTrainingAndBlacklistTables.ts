import { runQuery } from './postgres';

let trainingEnsured: Promise<void> | null = null;
let blacklistEnsured: Promise<void> | null = null;

export const ensureTrainingTables = async () => {
  if (!trainingEnsured) {
    trainingEnsured = (async () => {
      await runQuery(`
        create table if not exists public.training_campaigns (
          campaign_id text primary key,
          name text not null,
          status text null,
          channel text null,
          source text not null default 'crm',
          last_synced_at timestamptz null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `);

      await runQuery(`
        alter table public.training_campaigns
          add column if not exists status text,
          add column if not exists channel text,
          add column if not exists source text,
          add column if not exists last_synced_at timestamptz,
          add column if not exists updated_at timestamptz;
      `);

      await runQuery(`
        create table if not exists public.training_resources (
          id uuid primary key,
          campaign_id text not null references public.training_campaigns(campaign_id) on delete cascade,
          title text not null,
          description text null,
          resource_type text not null,
          url text null,
          storage_bucket text null,
          storage_path text null,
          uploaded_by uuid null,
          uploaded_by_name text null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          constraint chk_training_resource_type check (resource_type in ('youtube', 'link', 'file'))
        );
      `);

      await runQuery(`
        alter table public.training_resources
          add column if not exists description text,
          add column if not exists resource_type text,
          add column if not exists url text,
          add column if not exists storage_bucket text,
          add column if not exists storage_path text,
          add column if not exists uploaded_by uuid,
          add column if not exists uploaded_by_name text,
          add column if not exists updated_at timestamptz;
      `);

      await runQuery(
        `create index if not exists idx_training_campaigns_status on public.training_campaigns(status);`
      );
      await runQuery(
        `create index if not exists idx_training_resources_campaign on public.training_resources(campaign_id, created_at desc);`
      );
      await runQuery(
        `create index if not exists idx_training_resources_type on public.training_resources(resource_type);`
      );
    })().catch((error) => {
      trainingEnsured = null;
      throw error;
    });
  }

  await trainingEnsured;
};

export const ensureHrBlacklistTable = async () => {
  if (!blacklistEnsured) {
    blacklistEnsured = (async () => {
      await runQuery(`
        create table if not exists public.hr_blacklist (
          id uuid primary key,
          rut_normalized text not null unique,
          rut_display text not null,
          full_name text null,
          reason text null,
          source text null,
          notes text null,
          active boolean not null default true,
          import_batch_id uuid null,
          created_by uuid null,
          created_by_name text null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `);

      await runQuery(`
        alter table public.hr_blacklist
          add column if not exists full_name text,
          add column if not exists reason text,
          add column if not exists source text,
          add column if not exists notes text,
          add column if not exists active boolean,
          add column if not exists import_batch_id uuid,
          add column if not exists created_by uuid,
          add column if not exists created_by_name text,
          add column if not exists updated_at timestamptz;
      `);

      await runQuery(`update public.hr_blacklist set active = true where active is null;`);

      await runQuery(
        `create index if not exists idx_hr_blacklist_rut on public.hr_blacklist(rut_normalized);`
      );
      await runQuery(
        `create index if not exists idx_hr_blacklist_active on public.hr_blacklist(active, created_at desc);`
      );
    })().catch((error) => {
      blacklistEnsured = null;
      throw error;
    });
  }

  await blacklistEnsured;
};
