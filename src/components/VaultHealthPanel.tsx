/** Read-only vault status with one-click actions for the items that need
 *  attention. Monochrome and symmetric, matching account settings. */
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { classifyVaultHealth, type VaultHealth } from "@/lib/vault-health";

interface Props {
  userId: string;
  onUpgrade: () => void;
  onReenrollPasskey: () => void;
  onUnlock: () => void;
}

export default function VaultHealthPanel({ userId, onUpgrade, onReenrollPasskey, onUnlock }: Props) {
  const [health, setHealth] = useState<VaultHealth | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [files, passkeys, contacts, devices] = await Promise.all([
        supabase.from("files").select("encryption_key, tags").eq("user_id", userId).is("is_deleted", false),
        supabase.from("user_passkeys").select("public_key").eq("user_id", userId),
        supabase.from("recovery_contacts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("zk_devices").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      setHealth(classifyVaultHealth({
        files: (files.data || []) as any,
        passkeys: (passkeys.data || []) as any,
        recoveryContacts: contacts.count || 0,
        devices: devices.count || 0,
      }));
    } catch {
      setHealth(null); // status unavailable — never block other settings
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const act = (key: string, fn: () => void) => {
    setBusy(key);
    try { fn(); } finally { setBusy(""); }
  };

  return (
    <div className="vhealth">
      <style>{CSS}</style>
      <div className="vhealth-head">VAULT HEALTH</div>
      {!health ? (
        <div className="vhealth-muted">Status unavailable</div>
      ) : (
        <>
          <div className="vhealth-grid">
            <div><b>{health.v4Files}</b><span>E2E v4 files</span></div>
            <div><b>{health.legacyFiles}</b><span>Legacy files</span></div>
            <div><b>{health.verifiedPasskeys}/{health.passkeysTotal}</b><span>Verified passkeys</span></div>
            <div><b>{health.recoveryContacts}</b><span>Recovery shares</span></div>
            <div><b>{health.devices}</b><span>Enrolled devices</span></div>
          </div>
          {health.needsAttention ? (
            <ul className="vhealth-list">
              {health.recommendations.map((r) => <li key={r}>{r}</li>)}
            </ul>
          ) : (
            <div className="vhealth-ok">Everything is up to date</div>
          )}
          <div className="vhealth-actions">
            {health.legacyFiles > 0 && (
              <button type="button" disabled={!!busy} onClick={() => act("upgrade", onUpgrade)}>Upgrade files</button>
            )}
            {health.legacyPasskeys > 0 && (
              <button type="button" disabled={!!busy} onClick={() => act("passkey", onReenrollPasskey)}>Re-enroll passkey</button>
            )}
            {health.recoveryContacts < 3 && (
              <button type="button" disabled={!!busy} onClick={() => act("unlock", onUnlock)}>Add recovery shares</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const CSS = `
.vhealth{display:grid;gap:10px;color:var(--sa-text,#e8e7e1);font-family:var(--sa-f,system-ui,sans-serif)}
.vhealth-head{font:500 10px/1 var(--sa-mono,monospace);letter-spacing:.12em;color:var(--sa-mute,#8d8f89)}
.vhealth-muted,.vhealth-ok{font-size:12px;color:var(--sa-mute,#8d8f89)}
.vhealth-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}
.vhealth-grid>div{display:grid;gap:4px;padding:12px;border-radius:14px;text-align:center;
  border:1px solid var(--sa-line,#1f2221);background:linear-gradient(180deg,var(--sa-bg-3,#141816),var(--sa-bg-2,#0e1110))}
.vhealth-grid b{font-size:16px;font-weight:500}.vhealth-grid span{font-size:11px;color:var(--sa-mute,#8d8f89)}
.vhealth-list{margin:0;padding-left:18px;display:grid;gap:4px;font-size:12px;color:var(--sa-mute,#8d8f89)}
.vhealth-actions{display:flex;gap:8px;flex-wrap:wrap}
.vhealth-actions button{min-height:32px;padding:0 14px;border-radius:999px;cursor:pointer;font:inherit;font-size:12px;
  border:1px solid var(--sa-line,#1f2221);background:var(--sa-bg-4,#1b201d);color:var(--sa-text,#e8e7e1)}
.vhealth-actions button:disabled{opacity:.5;cursor:default}
`;
