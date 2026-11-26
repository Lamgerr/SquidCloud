/** Every path that writes new ciphertext must have a client-held key.
 *  Otherwise it would fall back to the legacy raw-key escrow path. */
import { hasV4Master } from './e2e-v4-session';
import { canStartUpload } from './e2e-upload-policy';

export async function assertClientKeyAvailable(userId: string): Promise<void> {
  if (hasV4Master()) return;
  const { getBYOKRuntimePolicy } = await import('./res54');
  const policy = await getBYOKRuntimePolicy(userId);
  if (!canStartUpload({ v4Prepared: false, byokActive: policy.enabled })) {
    throw new Error('Unlock your vault (or enable BYOK) before uploading or rewriting encrypted files');
  }
}
