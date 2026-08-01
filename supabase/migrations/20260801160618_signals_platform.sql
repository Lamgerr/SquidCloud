-- Signals: SquidCloud internal notification platform
-- Delivers in-app signals via Supabase Realtime. Clearing = deleting the row.

create table if not exists public.signals (
  id              uuid primary key default gen_random_uuid(),
  service_id      text not null check (service_id in ('cloudbliss', 'squidveil', 'signals')),
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            text not null,
  severity        text not null default 'info' check (severity in ('info', 'warning', 'urgent')),
  title           text not null check (char_length(title) between 1 and 200),
  body            text check (body is null or char_length(body) <= 1000),
  link            text check (link is null or char_length(link) <= 500),
  data            jsonb not null default '{}'::jsonb,
  read_at         timestamptz,
  expires_at      timestamptz,
  idempotency_key text,
  created_at      timestamptz not null default now()
);

-- NOTE: plain unique index (not partial). Partial indexes cannot be inferred by
-- ON CONFLICT (idempotency_key) DO NOTHING, which broke sendSignal(). Postgres
-- allows multiple NULL rows, which is correct for signals without a key.
create unique index if not exists signals_idempotency_key_unique
  on public.signals (idempotency_key);

create index if not exists idx_signals_user_created
  on public.signals (user_id, created_at desc);

create index if not exists idx_signals_user_unread
  on public.signals (user_id) where read_at is null;

alter table public.signals enable row level security;

-- Users can only ever touch their own signals (read / mark read / clear).
create policy "signals_select_own" on public.signals
  for select using (auth.uid() = user_id);

create policy "signals_update_own" on public.signals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "signals_delete_own" on public.signals
  for delete using (auth.uid() = user_id);

-- No INSERT policy for users: signals can only be created by edge functions
-- via the service-role key (which bypasses RLS). Users cannot spoof signals.

-- Realtime: subscribers only ever receive their own rows (RLS enforced).
alter publication supabase_realtime add table public.signals;

-- Housekeeping: purge signals older than 90 days (only if pg_cron is present).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'signals-cleanup',
      '0 3 * * *',
      $$delete from public.signals where created_at < now() - interval '90 days'$$
    );
  end if;
end
$$;
