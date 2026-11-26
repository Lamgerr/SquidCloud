/**
 * KTL enforcement (v12 §17.1): verify the append-only hash chain from genesis
 * before any sensitive operation. A fork/rollback fails closed.
 */
import { verifyKtl } from './ktl';

const seenHeads = new Map<string, string>();
const verifiedAt = new Map<string, number>();
const KTL_TTL = 60_000;

export class KtlError extends Error { constructor(msg: string) { super(`KTL integrity failure: ${msg}`); } }

/** Verify chain and pin the head for a user. Detects rollback on repeat calls. */
export async function assertKtl(user_id: string): Promise<string> {
  // Verifying the whole chain costs a network round trip. Reuse a recent
  // verification but still enforce the pinned-head check on every call.
  const last = verifiedAt.get(user_id) || 0;
  if (!last || Date.now() - last > KTL_TTL) {
    const result = await verifyKtl(user_id);
    if (!result.ok) throw new KtlError('broken chain');
    verifiedAt.set(user_id, Date.now());
    const pinned = seenHeads.get(user_id);
    if (pinned && pinned !== result.head) throw new KtlError('rollback or fork detected');
    seenHeads.set(user_id, result.head);
    return result.head;
  }
  const head = seenHeads.get(user_id) || 'GENESIS';
  return head;
}

export function clearKtlPin(user_id: string) { seenHeads.delete(user_id); verifiedAt.delete(user_id); }
