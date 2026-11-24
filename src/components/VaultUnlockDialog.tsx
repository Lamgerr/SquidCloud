import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, X, Shield } from '@/lib/icon-map';
import { unlockVault } from '@/lib/zk-vault-session';
import { verifyVaultPassword } from '@/lib/zk-vault-verify';

interface Props {
  open: boolean;
  userId: string;
  onClose: () => void;
  onUnlocked?: () => void;
  reason?: string;
}

export default function VaultUnlockDialog({ open, userId, onClose, onUnlocked, reason }: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!password) return;
    setBusy(true); setError('');
    try {
      const ok = await verifyVaultPassword(userId, password);
      if (!ok) throw new Error('Incorrect vault password');
      await unlockVault(password, userId);
      setPassword('');
      onUnlocked?.();
      onClose();
    } catch {
      setError('Could not unlock the vault');
    } finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="vu-root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="vu-card vu-glass"
            initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
            <div className="vu-ico"><Lock size={20} /></div>
            <h2>Unlock your vault</h2>
            <p>{reason || 'This file is encrypted. Enter your vault password to continue.'}</p>
            <input type="password" value={password} autoFocus placeholder="Vault password"
              onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
            {error && <span className="vu-err">{error}</span>}
            <div className="vu-actions">
              <button onClick={onClose}>Cancel</button>
              <button className="vu-primary" onClick={submit} disabled={busy || !password}>{busy ? 'Unlocking…' : 'Unlock'}</button>
            </div>
            <span className="vu-foot"><Shield size={12} /> Keys stay on this device</span>
          </motion.div>
          <style>{CSS}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const CSS = `
.vu-root{position:fixed;inset:0;z-index:500;display:grid;place-items:center;background:rgba(0,0,0,.6);padding:20px}
.vu-card{width:min(380px,100%);border-radius:24px;padding:26px;display:grid;justify-items:center;gap:10px;text-align:center;color:#e8e7e1}
.vu-glass{background:linear-gradient(180deg,rgba(32,33,29,.97),rgba(14,15,12,.98));border:1px solid rgba(232,231,225,.1);backdrop-filter:blur(20px);box-shadow:inset 0 1px 0 rgba(232,231,225,.06),0 24px 60px -20px rgba(0,0,0,.9)}
.vu-ico{width:44px;height:44px;display:grid;place-items:center;border-radius:999px;border:1px solid rgba(232,231,225,.1);background:rgba(232,231,225,.06)}
.vu-card h2{margin:0;font-size:18px;font-weight:600}.vu-card p{margin:0;font-size:13px;line-height:1.5;color:rgba(232,231,225,.6)}
.vu-card input{width:100%;height:44px;padding:0 14px;margin-top:6px;border:1px solid rgba(232,231,225,.12);border-radius:999px;background:rgba(232,231,225,.05);color:#e8e7e1;outline:none;font:400 14px/1 inherit}
.vu-card input:focus{border-color:rgba(232,231,225,.3)}
.vu-err{font-size:12px;color:#e8a0a0}
.vu-actions{display:flex;gap:8px;width:100%;margin-top:8px}
.vu-actions button{flex:1;height:40px;border:1px solid rgba(232,231,225,.12);border-radius:999px;background:transparent;color:rgba(232,231,225,.7);cursor:pointer;font-size:13px}
.vu-actions .vu-primary{background:rgba(232,231,225,.14);color:#e8e7e1}
.vu-actions button:disabled{opacity:.4}
.vu-foot{display:inline-flex;align-items:center;gap:6px;font-size:10px;color:rgba(232,231,225,.4);margin-top:4px}
`;
