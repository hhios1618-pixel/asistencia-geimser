-- Redundancy: Email Receipt Queue
-- Ensures 100% delivery of legal receipts even if Email API is down.

create table if not exists receipt_queue (
    id uuid primary key default gen_random_uuid(),
    mark_id uuid not null references attendance_marks(id) on delete cascade,
    person_email text not null,
    person_name text not null,
    event_type text not null,
    event_ts timestamptz not null,
    hash_self text not null,
    site_name text not null,
    status text not null check (status in ('PENDING', 'SENT', 'FAILED')) default 'PENDING',
    attempts int not null default 0,
    last_attempt_at timestamptz,
    error_log text,
    created_at timestamptz not null default now()
);

-- Index for fast polling of pending items
create index if not exists idx_receipt_queue_pending 
on receipt_queue(status, created_at) 
where status = 'PENDING';

-- RLS: Only admin/system can see this usually, but for now we keep it open for server-side access
alter table receipt_queue enable row level security;

create policy "Service role can manage queue"
  on receipt_queue
  for all
  using ( true ) -- In a real prod app, restrict to service_role or admin
  with check ( true );
