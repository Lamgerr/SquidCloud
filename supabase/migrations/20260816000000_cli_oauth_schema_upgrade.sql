-- CLI OAuth schema upgrade: align cli_devices / cli_authorizations with
-- the current cli-oauth edge function (device-code flow, anonymous bootstrap).

-- cli_devices: support pending device-code flow, anonymous user, new columns
ALTER TABLE cli_devices
  ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS cli_devices_machine_id_key,
  DROP CONSTRAINT IF EXISTS cli_devices_user_id_machine_id_key,
  ADD COLUMN IF NOT EXISTS device_code TEXT,
  ADD COLUMN IF NOT EXISTS client_id TEXT DEFAULT 'squidcloud-cli',
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'read write',
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ;

ALTER TABLE cli_devices
  DROP CONSTRAINT IF EXISTS cli_devices_status_check,
  ADD CONSTRAINT cli_devices_status_check
    CHECK (status IN ('pending', 'authorized', 'active', 'revoked', 'banned', 'expired'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_cli_devices_device_code ON cli_devices(device_code) WHERE device_code IS NOT NULL;

-- cli_authorizations: function uses code_hash + token_hash + used + redirect_uri
ALTER TABLE cli_authorizations
  ADD COLUMN IF NOT EXISTS code_hash TEXT,
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_id TEXT DEFAULT 'squidcloud-cli',
  ADD COLUMN IF NOT EXISTS redirect_uri TEXT,
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'read write',
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ;

ALTER TABLE cli_authorizations
  DROP CONSTRAINT IF EXISTS cli_authorizations_status_check,
  ADD CONSTRAINT cli_authorizations_status_check
    CHECK (status IN ('pending', 'approved', 'authorized', 'expired', 'revoked'));

CREATE INDEX IF NOT EXISTS idx_cli_auth_code_hash ON cli_authorizations(code_hash);
CREATE INDEX IF NOT EXISTS idx_cli_auth_token_hash_used ON cli_authorizations(token_hash, used);
