import { SUPABASE_URL } from '@/lib/supabaseEnv';

const BASE_URL = `${SUPABASE_URL}/functions/v1/squidveil-api`;
const TOKEN_KEY = 'squidveil_token';

export function getSquidVeilToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setSquidVeilToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSquidVeilToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function squidveilFetch<T = any>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOpts } = options;
  const tokenValue = token ?? getSquidVeilToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string>),
  };
  if (tokenValue) headers['X-SquidVeil-Token'] = tokenValue;

  const res = await fetch(`${BASE_URL}${path}`, { ...fetchOpts, headers });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export interface SquidVeilSecret {
  id: string;
  name: string;
  description?: string | null;
  labels?: Record<string, string> | null;
  secret_type: string;
  recovery_window_days: number;
  deleted_at?: string | null;
  delete_after?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SquidVeilToken {
  id: string;
  name: string;
  token_prefix: string;
  policies: string[];
  created_at: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
}

export interface StatsTotals {
  reads: number;
  writes: number;
  veilrefs_issued: number;
  veilrefs_resolved: number;
  veilrefs_verified: number;
  rotations: number;
  failed_auth: number;
}

export interface StatsResponse {
  success: boolean;
  days: number;
  totals: StatsTotals;
  top_secrets: { name: string; count: number }[];
  top_writes: { name: string; count: number }[];
  reads_by_token: { token_id: string; token_name: string; count: number }[];
  activity: { day: string; reads: number; writes: number; veilrefs: number; rotations: number }[];
}

export interface MonitorResponse {
  success: boolean;
  generated_at: string;
  audit: { valid: boolean; checked: number; last_seq: number };
  tokens: { total: number; active: number; revoked: number; expired: number };
  secrets: {
    total: number;
    pending_purge: { name: string; purge_at: string }[];
    rotation_enabled: number;
    rotation_due: { secret_name: string; next_rotation_at: string }[];
  };
  activity_24h: { reads: number; writes: number; veilrefs: number; rotations: number; failed_auth: number };
  recent_failed_auth: { seq: number; action: string; detail: string; path: string; ip: string | null; user_agent: string | null; created_at: string }[];
  recent_events: { seq: number; action: string; path: string; success: boolean; ip: string | null; created_at: string }[];
}
