-- CLI OAuth System Migration
-- Creates tables for CLI authorization and device management

-- 1. CLI Authorizations table
CREATE TABLE IF NOT EXISTS cli_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  device_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'expired', 'revoked')),
  access_token_hash TEXT,
  token_prefix TEXT,
  scopes TEXT[] DEFAULT ARRAY['read', 'write', 'delete'],
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  authorized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cli_auth_code ON cli_authorizations(code);
CREATE INDEX idx_cli_auth_device_code ON cli_authorizations(device_code);
CREATE INDEX idx_cli_auth_user ON cli_authorizations(user_id);
CREATE INDEX idx_cli_auth_token_hash ON cli_authorizations(access_token_hash);

-- 2. CLI Devices table
CREATE TABLE IF NOT EXISTS cli_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_id UUID REFERENCES cli_authorizations(id) ON DELETE SET NULL,
  device_name TEXT,
  machine_id TEXT NOT NULL,
  machine_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed', 'banned')),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, machine_id)
);

CREATE INDEX idx_cli_devices_user ON cli_devices(user_id);
CREATE INDEX idx_cli_devices_machine ON cli_devices(machine_id);
CREATE INDEX idx_cli_devices_status ON cli_devices(status);

-- 3. Row Level Security policies
ALTER TABLE cli_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cli_devices ENABLE ROW LEVEL SECURITY;

-- Users can read their own authorizations
CREATE POLICY "Users can read own CLI authorizations" ON cli_authorizations
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own authorizations (for the authorize endpoint)
CREATE POLICY "Users can insert own CLI authorizations" ON cli_authorizations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own authorizations
CREATE POLICY "Users can update own CLI authorizations" ON cli_authorizations
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can read their own devices
CREATE POLICY "Users can read own CLI devices" ON cli_devices
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own devices
CREATE POLICY "Users can insert own CLI devices" ON cli_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own devices
CREATE POLICY "Users can update own CLI devices" ON cli_devices
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own devices
CREATE POLICY "Users can delete own CLI devices" ON cli_devices
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access CLI authorizations" ON cli_authorizations
  FOR ALL USING (true);

CREATE POLICY "Service role full access CLI devices" ON cli_devices
  FOR ALL USING (true);

-- 4. Function to clean up expired authorizations
CREATE OR REPLACE FUNCTION cleanup_expired_cli_auths()
RETURNS void AS $$
BEGIN
  UPDATE cli_authorizations SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();

  DELETE FROM cli_authorizations
  WHERE status = 'expired' AND expires_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;
