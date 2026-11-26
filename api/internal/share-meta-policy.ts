/** Pure policy for releasing share metadata. Used by the BFF, tested independently. */
export type ShareAccessResult = { allowed: boolean; reason?: string; view_only?: boolean; share_type?: string };

type ShareRow = Record<string, unknown>;

const ALLOWED_FIELDS = [
  "file_id", "file_name", "file_type", "file_size", "file_created_at", "file_updated_at",
  "is_encrypted", "storage_path", "owner_id", "share_created_at", "share_expires_at", "share_download_limit",
  "share_download_count", "share_view_only", "share_require_email", "shared_encryption_key",
  "is_folder_share", "folder_id", "folder_name", "is_byok", "file_tags",
  // Flag only ("is BYOK"), never raw key material. Required by the share download path.
  "file_encryption_key",
] as const;

export function releaseShareMeta(access: ShareAccessResult, row: ShareRow): ShareRow | null {
  if (!access.allowed) return null;
  const out: ShareRow = {};
  for (const key of ALLOWED_FIELDS) {
    if (key === "file_encryption_key") continue;
    if (row[key] !== undefined) out[key] = row[key];
  }
  // Never release the stored key string. The share download path only needs
  // to know whether this is a BYOK file.
  if (row.file_encryption_key !== undefined) {
    out.file_encryption_key = typeof row.file_encryption_key === "boolean"
      ? row.file_encryption_key
      : /^(?:sha256:)?byok(?:_encrypted)?$/i.test(String(row.file_encryption_key));
  }
  out.share_view_only = access.view_only ?? row.share_view_only ?? false;
  return out;
}
