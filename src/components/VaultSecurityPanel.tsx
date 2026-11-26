/**
 * Vault security panel: device enrollment, social recovery, forward-secrecy
 * ratchet. All gated by an unlocked vault; no keys or shares in web storage.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Shield, KeyRound, Users, RefreshCw } from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { isVaultUnlocked } from '@/lib/zk-vault-session';
import { enrollDevice, wrapForDevice } from '@/lib/zk/webauthn';
import { createRecoveryShares, encryptShareForContact, storeRecoveryShares } from '@/lib/zk/social-recovery';
import { ratchetAdvance, currentEpoch, isRatcheted } from '@/lib/zk/ratchet';
import { getV4Master, setV4Master } from '@/lib/e2e-v4-session';
import { buildDeviceRecord } from '@/lib/recovery-wiring';
import { reconstructFromShares } from '@/lib/zk/social-recovery';
import { appendKtl } from '@/lib/zk/ktl';

const T = { type: 'spring' as const, stiffness: 420, damping: 28 };
const TAP = { type: 'spring' as const, stiffness: 600, damping: 16 };

export default function VaultSecurityPanel({ userId, onUnlock }: { userId: string; onUnlock?: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState('');
  const [shares, setShares] = useState<string[] | null>(null);
  const [epoch, setEpoch] = useState(currentEpoch());
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');

  if (!isVaultUnlocked()) {
    return (
      <div className="vsp vsp-locked">
        <style>{CSS}</style>
        <div className="vsp-lock-ico"><Lock size={18} /></div>
        <div className="vsp-lock-copy">
          <b>Vault is locked</b>
          <span>Unlock it to manage devices, recovery and key rotation.</span>
        </div>
        <motion.button type="button" className="vsp-unlock" onClick={onUnlock}
          whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }} transition={TAP}>
          Unlock vault
        </motion.button>
      </div>
    );
  }

  const enroll = async () => {
    setBusy('device');
    try {
      const mk = getV4Master();
      if (!mk) throw new Error('Unlock the vault with your password first');
      const d = await enrollDevice(userId);
      const wrappedMk = await wrapForDevice(d.prf, d.prfSalt, mk);
      const record = buildDeviceRecord(userId, {
        credentialId: d.credentialId, publicKey: d.publicKey, prfSalt: d.prfSalt,
      }, wrappedMk);
      const { error } = await supabase.from('zk_devices').insert(record);
      if (error) throw error;
      await appendKtl(userId, 'device_enrolled', { device_id: d.credentialId }).catch(() => {});
      toast({ title: 'Device enrolled', description: 'Passkey is ready for this device' });
    } catch (e: any) {
      toast({ title: 'Enrollment failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(''); }
  };

  const makeShares = async () => {
    setBusy('shares');
    try {
      const phrase = window.prompt('Enter your vault recovery phrase to generate shares');
      if (!phrase) return;
      const s = await createRecoveryShares(phrase);
      setShares(s);

      // Encrypt each share under a key derived from the phrase so the server
      // stores only opaque envelopes + commitments, never plaintext shares.
      const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveKey']);
      const shareKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('sq-v2/share-storage'), iterations: 120000 },
        keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
      );
      const envelopes = await Promise.all(s.map(async (share, i) => {
        const envelope = await encryptShareForContact(share, shareKey);
        const commitment = Array.from(new Uint8Array(
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode(share)),
        )).map(b => b.toString(16).padStart(2, '0')).join('');
        return { contact_id: `contact-${i + 1}`, envelope, commitment };
      }));
      await storeRecoveryShares(userId, envelopes);
      await appendKtl(userId, 'recovery_shares_created', { count: s.length }).catch(() => {});
      toast({ title: '5 recovery shares generated', description: 'Store them with trusted contacts — 3 are needed to recover' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(''); }
  };

  const restoreShares = async () => {
    setBusy('restore');
    try {
      const list = restoreInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      const mk = await reconstructFromShares(list);
      setV4Master(mk);
      mk.fill(0);
      setRestoreOpen(false);
      setRestoreInput('');
      await appendKtl(userId, 'vault_restored', { shares: list.length }).catch(() => {});
      onUnlock?.();
      toast({ title: 'Vault restored', description: 'Your master key has been recovered from shares' });
    } catch (e: any) {
      toast({ title: 'Recovery failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(''); }
  };

  const ratchet = async () => {
    if (!isRatcheted()) { toast({ title: 'Ratchet inactive', description: 'Unlock with the vault key first', variant: 'destructive' }); return; }
    setBusy('ratchet');
    try {
      const e = await ratchetAdvance();
      setEpoch(e);
      toast({ title: 'Key advanced', description: `Epoch ${e} — previous key destroyed` });
    } finally { setBusy(''); }
  };

  return (
    <div className="vsp">
      <style>{CSS}</style>
      <div className="vsp-head"><Shield size={15} /><span>VAULT SECURITY</span></div>

      <motion.button className="vsp-row" onClick={enroll} disabled={!!busy} whileHover={T} whileTap={{ scale: 0.98 }}>
        <KeyRound size={16} /><span><b>Enroll this device</b><small>Passkey · hardware-bound unlock</small></span>
      </motion.button>

      <motion.button className="vsp-row" onClick={makeShares} disabled={!!busy} whileHover={T} whileTap={{ scale: 0.98 }}>
        <Users size={16} /><span><b>Social recovery</b><small>5 shares · 3 to restore</small></span>
      </motion.button>

      <motion.button className="vsp-row" onClick={ratchet} disabled={!!busy} whileHover={T} whileTap={{ scale: 0.98 }}>
        <RefreshCw size={16} /><span><b>Advance key</b><small>Epoch {epoch} · destroys old key</small></span>
      </motion.button>

      <motion.button className="vsp-row" onClick={() => setRestoreOpen(v => !v)} disabled={!!busy} whileHover={T} whileTap={{ scale: 0.98 }}>
        <Users size={16} /><span><b>Restore from shares</b><small>3 of 5 shares · recovers this vault</small></span>
      </motion.button>

      {restoreOpen && (
        <div className="vsp-restore">
          <textarea
            className="vsp-restore-input"
            placeholder="Paste 3 recovery shares, one per line"
            value={restoreInput}
            onChange={e => setRestoreInput(e.target.value)}
            rows={3}
          />
          <motion.button type="button" className="vsp-restore-btn" onClick={restoreShares}
            disabled={!!busy || restoreInput.trim().length === 0}
            whileTap={{ scale: 0.98 }} transition={TAP}>
            Restore vault
          </motion.button>
        </div>
      )}

      {shares && (
        <div className="vsp-shares">
          {shares.map((s, i) => <code key={i} title={s}>Share {i + 1}: {s.slice(0, 18)}…</code>)}
        </div>
      )}
    </div>
  );
}

const CSS = `
.vsp{display:grid;gap:6px;color:var(--sa-text,#e8e7e1);font-family:var(--sa-f,system-ui,sans-serif)}
.vsp-locked{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:18px;
  border:1px solid var(--sa-line,#1f2221);
  background:linear-gradient(180deg,var(--sa-bg-3,#141816),var(--sa-bg-2,#0e1110));
  box-shadow:inset 0 1px 0 rgba(232,231,225,.06),0 18px 40px -24px rgba(0,0,0,.8)}
.vsp-lock-ico{flex:none;width:38px;height:38px;display:grid;place-items:center;border-radius:12px;
  background:var(--sa-bg-4,#1b201d);border:1px solid var(--sa-line,#1f2221);color:var(--sa-mute,#8d8f89)}
.vsp-lock-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.vsp-lock-copy b{font-size:13px;font-weight:500;color:var(--sa-text,#e8e7e1)}
.vsp-lock-copy span{font-size:11px;color:var(--sa-mute,#8d8f89)}
.vsp-unlock{flex:none;min-height:34px;padding:0 14px;border:1px solid var(--sa-line,#1f2221);border-radius:999px;
  background:var(--sa-bg-4,#1b201d);color:var(--sa-text,#e8e7e1);font:inherit;font-size:12px;cursor:pointer;
  box-shadow:inset 0 1px 0 rgba(232,231,225,.06)}
.vsp-head{display:flex;align-items:center;gap:8px;font:500 10px/1 var(--sa-mono,monospace);letter-spacing:.12em;color:var(--sa-mute,#8d8f89);margin-bottom:4px}
.vsp-row{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:14px;text-align:left;cursor:pointer;
  border:1px solid var(--sa-line,#1f2221);
  background:linear-gradient(180deg,var(--sa-bg-3,#141816),var(--sa-bg-2,#0e1110));color:var(--sa-text,#e8e7e1);
  box-shadow:inset 0 1px 0 rgba(232,231,225,.05)}
.vsp-row:hover{border-color:var(--sa-rim,#2f3230)}
.vsp-row:disabled{opacity:.5;cursor:default}
.vsp-row span{display:flex;flex-direction:column;gap:3px}.vsp-row b{font-size:13px;font-weight:500}.vsp-row small{font-size:11px;color:var(--sa-mute,#8d8f89)}
.vsp-shares{display:grid;gap:4px;padding:8px}.vsp-shares code{font:400 10px/1.4 var(--sa-mono,monospace);color:var(--sa-mute,#8d8f89);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vsp-restore{display:grid;gap:8px;padding:10px 4px 2px}
.vsp-restore-input{width:100%;box-sizing:border-box;resize:vertical;padding:10px 12px;border-radius:12px;
  border:1px solid var(--sa-line,#1f2221);background:var(--sa-bg-2,#0e1110);color:var(--sa-text,#e8e7e1);
  font:400 11px/1.5 var(--sa-mono,monospace);outline:none}
.vsp-restore-input:focus{border-color:var(--sa-rim,#2f3230)}
.vsp-restore-input::placeholder{color:var(--sa-mute,#8d8f89)}
.vsp-restore-btn{justify-self:end;min-height:32px;padding:0 14px;border-radius:999px;cursor:pointer;
  border:1px solid var(--sa-line,#1f2221);background:var(--sa-bg-4,#1b201d);color:var(--sa-text,#e8e7e1);font:inherit;font-size:12px}
.vsp-restore-btn:disabled{opacity:.5;cursor:default}
`;
