import { describe, expect, test } from "bun:test";
import {
  releaseShareMeta,
  type ShareAccessResult,
} from "../api/internal/share-meta-policy";

describe("share metadata release policy", () => {
  test("does not release metadata when access is denied", () => {
    const denied: ShareAccessResult = { allowed: false, reason: "wrong_password" };
    expect(releaseShareMeta(denied, {
      file_id: "f1", file_name: "secret.txt", storage_path: "res54_distributed",
      shared_encryption_key: "wrapped", access_code: "code", share_secret_hash: "hash",
    })).toBeNull();
  });

  test("releases only allow-listed fields after access is allowed", () => {
    const allowed: ShareAccessResult = { allowed: true, view_only: true, share_type: "public" };
    const released = releaseShareMeta(allowed, {
      file_id: "f1", file_name: "secret.txt", file_type: "text/plain", file_size: 12,
      file_created_at: "2026-01-01", file_updated_at: "2026-01-01", is_encrypted: true,
      storage_path: "res54_distributed", owner_id: "u1", share_created_at: "2026-01-01",
      share_expires_at: null, share_download_limit: 1, share_download_count: 0,
      share_view_only: true, share_require_email: false, shared_encryption_key: "wrapped",
      is_folder_share: false, folder_id: null, folder_name: null, is_byok: false,
      file_tags: ["{}"], file_encryption_key: "raw-key", access_code: "code",
      share_secret_hash: "hash",
    });
    expect(released).not.toBeNull();
    expect(released!.file_name).toBe("secret.txt");
    expect(released!.shared_encryption_key).toBe("wrapped");
    expect(released).not.toHaveProperty("access_code");
    expect(released).not.toHaveProperty("share_secret_hash");
    expect(released).not.toHaveProperty("file_encryption_key");
    expect(released).not.toHaveProperty("storage_path");
  });
});
