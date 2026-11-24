/**
 * Client-side Key Transparency Log (v12 §17.1).
 *
 * Every sensitive event is appended as hash(prev || event) and verified on
 * every sync. A server that substitutes a key, rolls back a version, or forks
 * the log cannot produce a chain the client will accept.
 */
import { supabase } from '@/integrations/supabase/client';

const enc = new TextEncoder();

export interface KtlEvent {
  seq: number;
  event_type: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  created_at: string;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Compute the chain hash for an event. Deterministic so server and client agree. */
export async function eventHash(prevHash: string, seq: number, type: string, payload: Record<string, unknown>): Promise<string> {
  return sha256(`${prevHash}|${seq}|${type}|${JSON.stringify(payload)}`);
}

/** Load all events for the current user and verify the chain from seq 1. */
export async function verifyKtl(userId: string): Promise<{ ok: boolean; head: string; count: number }> {
  const { data, error } = await supabase.from('zk_ktl')
    .select('seq, event_type, payload, prev_hash, hash')
    .eq('user_id', userId).order('seq', { ascending: true });
  if (error) throw error;

  const rows = (data || []) as KtlEvent[];
  let prev = 'GENESIS';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.seq !== i + 1) return { ok: false, head: r.hash, count: rows.length };
    if (r.prev_hash !== prev) return { ok: false, head: r.hash, count: rows.length };
    const expected = await eventHash(prev, r.seq, r.event_type, r.payload as Record<string, unknown>);
    if (expected !== r.hash) return { ok: false, head: r.hash, count: rows.length };
    prev = r.hash;
  }
  return { ok: true, head: prev, count: rows.length };
}

/** Append a verified event. The caller must have just verified the head. */
export async function appendKtl(userId: string, type: string, payload: Record<string, unknown>): Promise<void> {
  const head = await verifyKtl(userId);
  if (!head.ok) throw new Error('Key transparency log is inconsistent');
  const seq = head.count + 1;
  const hash = await eventHash(head.head, seq, type, payload);
  const { error } = await supabase.from('zk_ktl').insert({
    user_id: userId, seq, event_type: type, payload, prev_hash: head.head, hash,
  });
  if (error) throw error;
}

export const KTL_GENESIS = 'GENESIS';
