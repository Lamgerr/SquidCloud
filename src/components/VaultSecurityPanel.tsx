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
import { enrollDevice } from '@/lib/zk/webauthn';
import { createRecoveryShares, encryptShareForContact } from '@/lib/zk/social-recovery';
import { ratchetAdvance, currentEpoch, isRatcheted } from '@/lib/zk/ratchet';

const T = { type: 'spring' as const, stiffness: 420, damping: 28 };
const TAP = { type: 'spring' as const, stiffness: 600, damping: 16 };

export default function VaultSecurityPanel({ userId, onUnlock }: { userId: string; onUnlock?: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState('');
  const [shares, setShares] = useState<string[] | null>(null);
  const [epoch, setEpoch] = useState(currentEpoch());

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
      const d = await enrollDevice(userId);
      await supabase.from('zk_devices').insert({
        user_id: userId, device_id: d.credentialId,
        wrapped_mk: '', public_key: d.publicKey,
      });
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
      toast({ title: '5 recovery shares generated', description: 'Store them with trusted contacts — 3 are needed to recover' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
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
`;
