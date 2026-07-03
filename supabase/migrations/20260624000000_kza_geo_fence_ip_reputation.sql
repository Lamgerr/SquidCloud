-- KZA Geo-Fence & IP Reputation Enforcement
-- Creates tables for country-level access control and IP reputation caching

-- Geo-fence rules: country-level allow/block
create table if not exists kza_geo_fence (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  action text not null check (action in ('allow', 'block')),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kza_geo_fence_country on kza_geo_fence(country_code);
create index if not exists idx_kza_geo_fence_action on kza_geo_fence(action);

-- IP reputation cache: stores checked IPs with their scores
create table if not exists kza_ip_reputation (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null unique,
  score integer not null default 0,
  is_vpn boolean not null default false,
  is_datacenter boolean not null default false,
  is_proxy boolean not null default false,
  is_tor boolean not null default false,
  is_trusted boolean not null default false,
  org text,
  isp text,
  asn text,
  country_code text,
  city text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_kza_ip_reputation_ip on kza_ip_reputation(ip_address);
create index if not exists idx_kza_ip_reputation_score on kza_ip_reputation(score);

-- Add ip_address index on kza_banned_entities for faster lookups
create index if not exists idx_kza_banned_entities_ip on kza_banned_entities(ip_address) where ip_address is not null;

-- Add recheck_at column to kza_banned_entities for auto-expiring reputation-based bans
alter table kza_banned_entities add column if not exists recheck_at timestamptz;
alter table kza_banned_entities add column if not exists ban_source text default 'MANUAL' check (ban_source in ('MANUAL', 'GEO_FENCE', 'IP_REPUTATION', 'KZA_SENTINEL'));

-- Enable RLS (service_role only, same as other KZA tables)
alter table kza_geo_fence enable row level security;
alter table kza_ip_reputation enable row level security;

-- Deny all for anon and authenticated users
create policy "service_role only — kza_geo_fence" on kza_geo_fence
  for all using (false) with check (false);

create policy "service_role only — kza_ip_reputation" on kza_ip_reputation
  for all using (false) with check (false);

-- Grant to service_role
grant all on kza_geo_fence to service_role;
grant all on kza_ip_reputation to service_role;
