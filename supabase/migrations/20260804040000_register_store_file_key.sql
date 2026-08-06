-- store-file-key needs a kza_prel_registry row so the gateway accepts
-- authenticated user JWTs (mirrors file-key / secure-file-metadata).
insert into kza_prel_registry (function_id, function_name, description, required_auth_level, cip_required, f2fa_required, chain_depth_limit, allowed_callers, ttl_seconds, long_op_ttl_seconds, is_active, required_min_role, rate_limit_rps, rate_limit_burst, geo_velocity_check, geo_max_speed_kmh)
values ('store-file-key', 'Store File Key', 'Stores a file encryption key in the server-side vault for managed-key files', 'jwt', false, false, 3, '{}'::text[], 300, 3600, true, null, 10, 30, false, 900)
on conflict (function_id) do update set required_auth_level = 'jwt', is_active = true;
