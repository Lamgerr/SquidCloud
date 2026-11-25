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

export default function VaultSecurityPanel({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState('');
  const [shares, setShares] = useState<string[] | null>(null);
  const [epoch, setEpoch] = useState(currentEpoch());

  if (!isVaultUnlocked()) {
    return (
      <div className="vsp vsp-locked">
        <Lock size={18} /><span>Unlock your vault to manage security</span>
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
.vsp{display:grid;gap:6px;color:#e8e7e1;font-family:var(--sa-f,system-ui,sans-serif)}
.vsp-locked{display:flex;align-items:center;gap:10px;padding:14px;border-radius:16px;
  border:1px solid rgba(232,231,225,.1);background:rgba(13,14,13,.6);font-size:13px;color:rgba(232,231,225,.6)}
.vsp-head{display:flex;align-items:center;gap:8px;font:500 10px/1 var(--sa-mono,monospace);letter-spacing:.12em;color:rgba(232,231,225,.5);margin-bottom:4px}
.vsp-row{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:14px;text-align:left;cursor:pointer;
  border:1px solid rgba(232,231,225,.1);background:linear-gradient(180deg,rgba(30,31,28,.7),rgba(14,15,12,.8));color:#e8e7e1}
.vsp-row:disabled{opacity:.5;cursor:default}
.vsp-row span{display:flex;flex-direction:column;gap:3px}.vsp-row b{font-size:13px;font-weight:500}.vsp-row small{font-size:11px;color:rgba(232,231,225,.5)}
.vsp-shares{display:grid;gap:4px;padding:8px}.vsp-shares code{font:400 10px/1.4 var(--sa-mono,monospace);color:rgba(232,231,225,.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;
