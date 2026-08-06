-- 20260804020000_file_key_vault.sql
-- Move file encryption keys out of `files.tags` (REST-visible raw keys) into a
-- server-side vault (file_key_vault), wrapped with AES-256-GCM under a KEK
-- derived from SQUIDVEIL_MASTER_KEY in the edge functions.
--
-- The previous pgsodium keyring RPCs (encrypt/decrypt_keyring_secret) are
-- non-functional (keyring keys are aead-det, RPCs use the secretbox primitive;
-- the project root key is unavailable) and are revoked from client roles.
-- Edge functions use service_role and keep EXECUTE.

create table if not exists public.file_key_vault (
  file_id uuid primary key references public.files (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  wrapped_key text not null,
  iv text not null,
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.file_key_vault enable row level security;

create policy "file_key_vault owner all"
on public.file_key_vault
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on public.file_key_vault from anon;

-- Client roles must not wrap/unwrap with the (dead) pgsodium keyring.
revoke execute on function public.encrypt_keyring_secret(text, text) from public;
revoke execute on function public.decrypt_keyring_secret(text, text, text) from public;
grant execute on function public.encrypt_keyring_secret(text, text) to service_role;
grant execute on function public.decrypt_keyring_secret(text, text, text) to service_role;
