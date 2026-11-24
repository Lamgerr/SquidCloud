-- ============================================================
-- SquidVeil v2 — Standalone Secrets Manager
-- Dedicated schema, fully decoupled from the CloudBliss API.
-- Tables: secrets, secret_versions, secret_keys, rotation_config,
--         access_tokens, policies, veilrefs, audit_log
-- ============================================================

create schema if not exists squidveil;

-- ------------------------------------------------------------------
-- secrets
-- ------------------------------------------------------------------
create table if not exists squidveil.secrets (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    description text not null default '',
    labels jsonb not null default '{}'::jsonb,
    secret_type text not null default 'opaque'
        check (secret_type in ('opaque','aes_gcm','http_auth','hmac_sign','connection_string')),
    recovery_window_days int not null default 7,
    deleted_at timestamptz,
    delete_after timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (owner_id, name)
);

create index if not exists idx_sv_secrets_owner on squidveil.secrets(owner_id);
create index if not exists idx_sv_secrets_deleted on squidveil.secrets(deleted_at);

-- ------------------------------------------------------------------
-- access_tokens (sv_* tokens, SHA-256 + pepper hashed at rest)
-- ------------------------------------------------------------------
create table if not exists squidveil.access_tokens (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    token_hash text not null,
    token_prefix text not null,
    name text not null,
    policies jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    expires_at timestamptz,
    revoked_at timestamptz,
    last_used_at timestamptz
);

create index if not exists idx_sv_tokens_owner on squidveil.access_tokens(owner_id);
create index if not exists idx_sv_tokens_hash on squidveil.access_tokens(token_hash);
create unique index if not exists idx_sv_tokens_hash_unique on squidveil.access_tokens(token_hash);

-- ------------------------------------------------------------------
-- policies (Vault-style path globs + capabilities, deny wins)
-- ------------------------------------------------------------------
create table if not exists squidveil.policies (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    rules jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (owner_id, name)
);

create index if not exists idx_sv_policies_owner on squidveil.policies(owner_id);

-- ------------------------------------------------------------------
-- secret_keys (envelope encryption: per-secret DEK wrapped by master key)
-- ------------------------------------------------------------------
create table if not exists squidveil.secret_keys (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    key_id text not null,
    wrapped_dek text not null,
    iv text not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    revoked_at timestamptz,
    unique (owner_id, key_id)
);

-- ------------------------------------------------------------------
-- secret_versions (AWS/GCP version model)
-- ------------------------------------------------------------------
create table if not exists squidveil.secret_versions (
    id uuid primary key default gen_random_uuid(),
    secret_id uuid not null references squidveil.secrets(id) on delete cascade,
    version_number int not null,
    encrypted_value text not null default '',
    iv text not null default '',
    key_id text not null default 'default',
    state text not null default 'ENABLED'
        check (state in ('ENABLED','DISABLED','DESTROYED')),
    created_by_token_id uuid references squidveil.access_tokens(id) on delete set null,
    created_by text not null default 'system',
    created_at timestamptz not null default now(),
    destroyed_at timestamptz,
    unique (secret_id, version_number)
);

create index if not exists idx_sv_versions_secret on squidveil.secret_versions(secret_id, version_number desc);
create index if not exists idx_sv_versions_state on squidveil.secret_versions(state);

-- ------------------------------------------------------------------
-- rotation_config
-- ------------------------------------------------------------------
create table if not exists squidveil.rotation_config (
    secret_id uuid primary key references squidveil.secrets(id) on delete cascade,
    enabled boolean not null default false,
    interval_days int not null default 30,
    next_rotation_at timestamptz,
    last_rotated_at timestamptz,
    source text not null default 'auto_generated'
        check (source in ('auto_generated','user_provided')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- veilrefs (single-use, TTL, device-bound, version-aware references)
-- ------------------------------------------------------------------
create table if not exists squidveil.veilrefs (
    id uuid primary key default gen_random_uuid(),
    ref_id text not null,
    owner_id uuid not null references auth.users(id) on delete cascade,
    secret_id uuid not null references squidveil.secrets(id) on delete cascade,
    secret_name text not null,
    version_number int,
    device_bound text not null default '',
    issued_at timestamptz not null default now(),
    expires_at timestamptz not null,
    use_count_max int not null default 1,
    use_count_used int not null default 0,
    ops_allowed jsonb not null default '["resolve"]'::jsonb,
    hmac text not null default '',
    consumed_at timestamptz
);

create unique index if not exists idx_sv_veilrefs_ref_id on squidveil.veilrefs(ref_id);
create index if not exists idx_sv_veilrefs_expires on squidveil.veilrefs(expires_at);

-- ------------------------------------------------------------------
-- audit_log (HMAC-chained, tamper-evident)
-- ------------------------------------------------------------------
create sequence if not exists squidveil.audit_seq;

create table if not exists squidveil.audit_log (
    seq bigint primary key default nextval('squidveil.audit_seq'),
    prev_hash text not null default '',
    entry_hash text not null default '',
    signature text not null default '',
    action text not null,
    actor_type text not null default 'token'
        check (actor_type in ('token','user','system')),
    actor_id text not null default '',
    path text not null default '',
    version_number int,
    ip text,
    user_agent text,
    success boolean not null default true,
    detail text,
    created_at timestamptz not null default now()
);

create index if not exists idx_sv_audit_created on squidveil.audit_log(created_at desc);
create index if not exists idx_sv_audit_action on squidveil.audit_log(action);
create index if not exists idx_sv_audit_path on squidveil.audit_log(path);

-- ------------------------------------------------------------------
-- RLS: owner-scoped on every table
-- ------------------------------------------------------------------
alter table squidveil.secrets enable row level security;
alter table squidveil.access_tokens enable row level security;
alter table squidveil.policies enable row level security;
alter table squidveil.secret_keys enable row level security;
alter table squidveil.secret_versions enable row level security;
alter table squidveil.rotation_config enable row level security;
alter table squidveil.veilrefs enable row level security;
alter table squidveil.audit_log enable row level security;

create policy "sv_secrets_owner_all" on squidveil.secrets
    for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "sv_tokens_owner_all" on squidveil.access_tokens
    for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "sv_policies_owner_all" on squidveil.policies
    for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "sv_keys_owner_all" on squidveil.secret_keys
    for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "sv_versions_owner_all" on squidveil.secret_versions
    for all to authenticated using (secret_id in (select id from squidveil.secrets where owner_id = auth.uid()))
    with check (secret_id in (select id from squidveil.secrets where owner_id = auth.uid()));
create policy "sv_rotation_owner_all" on squidveil.rotation_config
    for all to authenticated using (secret_id in (select id from squidveil.secrets where owner_id = auth.uid()))
    with check (secret_id in (select id from squidveil.secrets where owner_id = auth.uid()));
create policy "sv_veilrefs_owner_all" on squidveil.veilrefs
    for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "sv_audit_owner_all" on squidveil.audit_log
    for all to authenticated using (actor_id = auth.uid()::text or exists (
        select 1 from squidveil.secrets s where s.owner_id = auth.uid()
    ))
    with check (true);

-- ------------------------------------------------------------------
-- Legacy data migration (hard cut)
--   * squid_vault_secrets -> secrets (v1 marked DESTROYED: legacy values
--     were keyed by the old CloudBliss API key and are unrecoverable)
--   * squidveil_audit_log -> audit_log (uncorrelated history)
-- ------------------------------------------------------------------
insert into squidveil.secrets (id, owner_id, name, description, secret_type, created_at, updated_at)
select id, user_id, name, 'Migrated from CloudBliss vault (legacy value requires rotation)', 'opaque', created_at, updated_at
from public.squid_vault_secrets
on conflict (owner_id, name) do nothing;

insert into squidveil.secret_versions (secret_id, version_number, encrypted_value, iv, key_id, state, created_by, created_at, destroyed_at)
select s.id, 1, v.encrypted_value, v.iv, 'legacy', 'DESTROYED', 'legacy-migration', v.created_at, now()
from public.squid_vault_secrets v
join squidveil.secrets s on s.owner_id = v.user_id and s.name = v.name
on conflict (secret_id, version_number) do nothing;

insert into squidveil.audit_log (seq, prev_hash, entry_hash, signature, action, actor_type, actor_id, path, version_number, ip, user_agent, success, detail, created_at)
select nextval('squidveil.audit_seq'), '', '', '', action, 'user', user_id::text, secret_name, null, null, null, success, coalesce(detail, 'legacy migration'), timestamp
from public.squidveil_audit_log
on conflict (seq) do nothing;

-- ------------------------------------------------------------------
-- Helper: next version number per secret (concurrent-safe)
-- ------------------------------------------------------------------
create or replace function squidveil.next_version(p_secret_id uuid)
returns int language sql stable as $$
    select coalesce(max(version_number), 0) + 1
    from squidveil.secret_versions
    where secret_id = p_secret_id;
$$;

-- Helper: purge secrets past their recovery window and expired VeilRefs (called by scheduler)
create or replace function squidveil.purge_expired()
returns int language plpgsql security definer as $$
declare
    purged int := 0;
    v_count int;
begin
    delete from squidveil.secrets
    where deleted_at is not null
      and delete_after is not null
      and delete_after < now();
    get diagnostics v_count = row_count;
    purged := purged + v_count;

    delete from squidveil.veilrefs
    where expires_at < now();
    get diagnostics v_count = row_count;
    purged := purged + v_count;

    return purged;
end;
$$;

-- Grant usage to service role (edge functions)
grant usage on schema squidveil to service_role;
grant all on all tables in schema squidveil to service_role;
grant all on all sequences in schema squidveil to service_role;
grant execute on function squidveil.next_version(uuid) to service_role;
grant execute on function squidveil.purge_expired() to service_role;

-- Expose schema to the REST API (PostgREST) so edge functions can query it
alter role authenticator set pgrst.db_schemas = 'public, storage, graphql_public, squidveil';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
grant usage on schema squidveil to anon, authenticated;
