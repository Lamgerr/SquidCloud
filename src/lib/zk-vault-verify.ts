/** Verify a vault password against the stored hash before deriving the ZK key. */
import { supabase } from '@/integrations/supabase/client';

const b64 = (b: Uint8Array) => { let s = ''; b.forEach(x => s += String.fromCharCode(x)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');

export async function verifyVaultPassword(userId: string, password: string): Promise<boolean> {
  const { data } = await supabase.from('vaults').select('password_hash').eq('user_id', userId).maybeSingle();
  const stored = data?.password_hash as string | undefined;
  if (!stored) return false;

  if (stored.startsWith('pbkdf2$')) {
    const [, iterStr, saltB64, expected] = stored.split('$');
    const iterations = parseInt(iterStr, 10) || 310000;
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: unb64(saltB64) as any, iterations, hash: 'SHA-256' }, material, 256,
    );
    return b64(new Uint8Array(bits)) === expected;
  }

  // Legacy unsalted SHA-256 hex
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))) === stored;
}
