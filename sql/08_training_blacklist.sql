-- Training repository + HR blacklist

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

create index if not exists idx_training_campaigns_status on public.training_campaigns(status);
create index if not exists idx_training_resources_campaign on public.training_resources(campaign_id, created_at desc);
create index if not exists idx_training_resources_type on public.training_resources(resource_type);

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

create index if not exists idx_hr_blacklist_rut on public.hr_blacklist(rut_normalized);
create index if not exists idx_hr_blacklist_active on public.hr_blacklist(active, created_at desc);
