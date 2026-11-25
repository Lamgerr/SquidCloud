/**
 * KTL enforcement (v12 §17.1): verify the append-only hash chain from genesis
 * before any sensitive operation. A fork/rollback fails closed.
 */
import { verifyKtl } from './ktl';

const seenHeads = new Map<string, string>();

export class KtlError extends Error { constructor(msg: string) { super(`KTL integrity failure: ${msg}`); } }

/** Verify chain and pin the head for a user. Detects rollback on repeat calls. */
export async function assertKtl(user_id: string): Promise<string> {
  const result = await verifyKtl(user_id);
  if (!result.ok) throw new KtlError('broken chain');
  const previous = seenHeads.get(user_id);
  if (previous && previous !== result.head) throw new KtlError('rollback or fork detected');
  seenHeads.set(user_id, result.head);
  return result.head;
}

export function clearKtlPin(user_id: string) { seenHeads.delete(user_id); }
