// Shared S-Hawk upload-gate helpers for URL-minting functions.
// Single source of truth: ban check + verdict-token verification.

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface SwkGateResult {
  ok: boolean;
  status: number;
  error?: string;
  code?: string;
  decision?: string;
}

// Hard stop when the user carries an active, non-shadow ban.
// Returns ok=true when clear (or when the lookup itself fails —
// fail-open on infra errors, mirroring the geo-fence convention).
export async function swkCheckUploadBan(supabase: any, userId: string): Promise<SwkGateResult> {
  if (!userId || userId === "anonymous") {
    return { ok: false, status: 403, error: "Authentication required for uploads.", code: "SWK_AUTH_REQUIRED" };
  }
  try {
    const now = new Date();
    const { data: bans, error } = await supabase
      .from("kza_banned_entities")
      .select("id,ban_reason,ban_type,banned_until")
      .eq("is_active", true)
      .eq("shadow", false)
      .eq("user_id", userId);
    if (error) {
      console.error("[swk] ban lookup error:", error.message);
      return { ok: true, status: 200 };
    }
    const hardBan = (bans || []).find((b: any) =>
      b.ban_type === "PERMANENT" || !b.banned_until || new Date(b.banned_until) > now
    );
    if (hardBan) {
      return {
        ok: false, status: 403,
        error: `Uploads suspended: ${hardBan.ban_reason || "account under KZA review"}`,
        code: "SWK_UPLOADS_SUSPENDED",
      };
    }
    return { ok: true, status: 200 };
  } catch (e: any) {
    console.error("[swk] ban lookup exception:", e?.message);
    return { ok: true, status: 200 };
  }
}

// Verdict tokens are minted by kza-swk/scan and bound to
// (user, manifest hash, file size). Short TTL, capped uses.
export async function swkVerifyToken(
  supabase: any,
  opts: { userId: string; token: string; manifestHash: string; sizeBytes: number }
): Promise<SwkGateResult> {
  const { userId, token, manifestHash, sizeBytes } = opts;
  if (!token || !manifestHash) {
    return {
      ok: false, status: 403,
      error: "S-Hawk screening required: scan the file manifest before uploading.",
      code: "SWK_TOKEN_REQUIRED",
    };
  }
  try {
    const tokenHash = await sha256Hex(token);
    const { data: tok, error } = await supabase
      .from("kza_swk_verdict_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error || !tok) {
      return { ok: false, status: 403, error: "S-Hawk verdict invalid: re-scan the file manifest before uploading.", code: "SWK_TOKEN_INVALID" };
    }
    if (new Date(tok.expires_at) <= new Date()) {
      return { ok: false, status: 403, error: "S-Hawk verdict expired: re-scan the file manifest before uploading.", code: "SWK_TOKEN_EXPIRED" };
    }
    if (tok.user_id !== userId || tok.manifest_hash !== manifestHash) {
      return { ok: false, status: 403, error: "S-Hawk verdict does not match this file: re-scan before uploading.", code: "SWK_TOKEN_MISMATCH" };
    }
    // Size binding is lenient when the caller does not know the total yet.
    if (sizeBytes > 0 && Number(tok.size_bytes) !== sizeBytes) {
      return { ok: false, status: 403, error: "S-Hawk verdict does not match this file: re-scan before uploading.", code: "SWK_TOKEN_MISMATCH" };
    }
    if (tok.decision !== "allow" && tok.decision !== "review") {
      return { ok: false, status: 403, error: "S-Hawk did not clear this file for upload.", code: "SWK_TOKEN_DECISION" };
    }
    if (Number(tok.used_count) >= Number(tok.max_uses)) {
      return { ok: false, status: 403, error: "S-Hawk verdict exhausted: re-scan the file manifest before uploading.", code: "SWK_TOKEN_EXHAUSTED" };
    }
    await supabase.from("kza_swk_verdict_tokens").update({ used_count: Number(tok.used_count) + 1 }).eq("token_hash", tokenHash);
    return { ok: true, status: 200, decision: String(tok.decision || "allow") };
  } catch (e: any) {
    console.error("[swk] token verify exception:", e?.message);
    return { ok: false, status: 403, error: "S-Hawk verification failed: re-scan the file manifest before uploading.", code: "SWK_TOKEN_ERROR" };
  }
}
