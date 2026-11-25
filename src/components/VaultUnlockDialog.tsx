import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, X, Shield } from '@/lib/icon-map';
import { unlockVault } from '@/lib/zk-vault-session';
import { verifyVaultPassword } from '@/lib/zk-vault-verify';
import { useShake } from '@/hooks/use-shake';

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
  const { trigger: shake, shakeClass } = useShake();

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
      shake();
      setError('Could not unlock the vault');
    } finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="vu-root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className={`vu-card vu-glass ${shakeClass}`}
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
.vu-root{position:fixed;inset:0;z-index:500;display:grid;place-items:center;
  background:rgba(3,4,3,.76);backdrop-filter:blur(8px);padding:20px}
.vu-card{width:min(380px,100%);border-radius:22px;padding:26px;display:grid;justify-items:center;gap:10px;text-align:center;
  color:var(--sa-text,#e8e7e1);font-family:var(--sa-f,-apple-system,system-ui,sans-serif)}
.vu-glass{background:linear-gradient(180deg,var(--sa-bg-4,#1b201d),var(--sa-bg-2,#0e1110));
  border:1px solid var(--sa-line,#1f2221);
  box-shadow:inset 0 1px 0 rgba(232,231,225,.07),0 30px 70px -24px rgba(0,0,0,.95)}
.vu-ico{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;
  border:1px solid var(--sa-line,#1f2221);background:var(--sa-bg-3,#141816);color:var(--sa-text,#e8e7e1)}
.vu-card h2{margin:0;font-size:18px;font-weight:500;letter-spacing:-.02em}
.vu-card p{margin:0;font-size:13px;line-height:1.5;color:var(--sa-mute,#8d8f89)}
.vu-card input{width:100%;height:46px;padding:0 14px;margin-top:6px;border:1px solid var(--sa-line,#1f2221);
  border-radius:999px;background:var(--sa-bg,#090b0a);color:var(--sa-text,#e8e7e1);outline:none;font:400 14px/1 inherit}
.vu-card input:focus{border-color:var(--sa-text,#e8e7e1)}
.vu-err{font-size:12px;color:#e8a0a0}
.vu-actions{display:flex;gap:8px;width:100%;margin-top:8px}
.vu-actions button{flex:1;height:40px;border:1px solid var(--sa-line,#1f2221);border-radius:999px;
  background:transparent;color:var(--sa-mute,#8d8f89);cursor:pointer;font-size:13px;transition:color .18s,background .18s}
.vu-actions button:hover{color:var(--sa-text,#e8e7e1);background:var(--sa-bg-3,#141816)}
.vu-actions .vu-primary{background:linear-gradient(180deg,var(--sa-bg-4,#1b201d),var(--sa-bg-3,#141816));
  color:var(--sa-text,#e8e7e1);box-shadow:inset 0 1px 0 rgba(232,231,225,.07)}
.vu-actions button:disabled{opacity:.4}
.vu-foot{display:inline-flex;align-items:center;gap:6px;font-size:10px;color:var(--sa-dim,#62655f);margin-top:4px}
`;
