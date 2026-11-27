/** Pure vault-health classifier used by the account settings panel. No
 *  Supabase imports so it stays testable and free of key material. */

export type VaultHealthInput = {
  files: Array<{ encryption_key?: string | null; tags?: string[] | null }>;
  passkeys: Array<{ public_key?: string | null }>;
  recoveryContacts: number;
  devices: number;
};

export type VaultHealth = {
  totalFiles: number;
  v4Files: number;
  legacyFiles: number;
  passkeysTotal: number;
  verifiedPasskeys: number;
  legacyPasskeys: number;
  recoveryContacts: number;
  devices: number;
  needsAttention: boolean;
  recommendations: string[];
};

function isV4File(file: VaultHealthInput["files"][number]): boolean {
  if (file.encryption_key === "e2e_v4") return true;
  for (const tag of file.tags || []) {
    try { if (JSON.parse(tag)?.v4?.fileId) return true; } catch { /* not v4 */ }
  }
  return false;
}

function isVerifiablePasskey(passkey: VaultHealthInput["passkeys"][number]): boolean {
  const raw = passkey.public_key;
  if (!raw) return false;
  const value = String(raw);
  if (value.startsWith("{")) {
    try { return !!JSON.parse(value).kty; } catch { return false; }
  }
  // Legacy DER-SPKI verifiers are base64 strings, far longer than a label.
  return value.length > 40;
}

export function classifyVaultHealth(input: VaultHealthInput): VaultHealth {
  const totalFiles = input.files.length;
  const v4Files = input.files.filter(isV4File).length;
  const legacyFiles = totalFiles - v4Files;
  const passkeysTotal = input.passkeys.length;
  const verifiedPasskeys = input.passkeys.filter(isVerifiablePasskey).length;
  const legacyPasskeys = passkeysTotal - verifiedPasskeys;
  const recommendations: string[] = [];
  if (legacyFiles > 0) recommendations.push(`${legacyFiles} legacy file(s) can be upgraded to E2E v4`);
  if (legacyPasskeys > 0) recommendations.push(`${legacyPasskeys} passkey(s) lack a verifier — re-enroll them`);
  if (input.recoveryContacts < 3) recommendations.push("Add recovery shares (3 of 5 needed to restore)");
  if (input.devices === 0) recommendations.push("Enroll this device for hardware-bound unlock");
  return {
    totalFiles, v4Files, legacyFiles,
    passkeysTotal, verifiedPasskeys, legacyPasskeys,
    recoveryContacts: input.recoveryContacts,
    devices: input.devices,
    needsAttention: recommendations.length > 0,
    recommendations,
  };
}
