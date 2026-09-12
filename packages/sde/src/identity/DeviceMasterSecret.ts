let memStore: Uint8Array | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

async function getSupabaseClient() {
  const { supabase } = await import("@/integrations/supabase/client.ts");
  return supabase;
}

async function dbGet(): Promise<Uint8Array | null> {
  try {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("sde_identity" as any)
      .select("dms")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return null;
    const raw = (data as any).dms;
    if (!raw) return null;

    // Supabase JS returns bytea as hex string (with or without \x prefix)
    if (typeof raw === "string") {
      const hex = raw.startsWith("\\x") ? raw.slice(2) : raw;
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        const v = parseInt(hex.substr(i * 2, 2), 16);
        if (isNaN(v)) return null;
        bytes[i] = v;
      }
      return bytes;
    }
    return new Uint8Array(raw);
  } catch (e) {
    console.error("[DMS] dbGet error:", e);
    return null;
  }
}

async function dbPut(dms: Uint8Array): Promise<void> {
  try {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("not authenticated");

    const hex = Array.from(dms).map(b => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase
      .from("sde_identity" as any)
      .upsert({ user_id: user.id, dms: `\\x${hex}`, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (error) throw error;
  } catch (e) {
    console.error("[DMS] DB write failed:", e);
    throw e;
  }
}

async function memGet(): Promise<Uint8Array | null> {
  if (memStore) return memStore;
  try {
    const { readFileSync, existsSync } = await import("node:fs");
    const path = (await import("node:path")).default.join(
      (await import("node:os")).default.homedir(), ".sde-dms"
    );
    if (existsSync(path)) {
      const buf = new Uint8Array(readFileSync(path));
      if (buf.length === 32) { memStore = buf; return buf; }
    }
  } catch {}
  return null;
}

async function memPut(value: Uint8Array): Promise<void> {
  memStore = value;
  try {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const path = (await import("node:path")).default.join(
      (await import("node:os")).default.homedir(), ".sde-dms"
    );
    mkdirSync((await import("node:path")).default.dirname(path), { recursive: true });
    writeFileSync(path, value);
  } catch {}
}

export async function getOrCreateDMS(): Promise<Uint8Array> {
  // Browser: Supabase DB (RLS-protected)
  if (isBrowser()) {
    const existing = await dbGet();
    if (existing && existing.length === 32) return existing;

    const dms = new Uint8Array(32);
    crypto.getRandomValues(dms);
    await dbPut(dms);
    return dms;
  }

  // Node.js: filesystem
  const existing = await memGet();
  if (existing && existing.length === 32) return existing;
  const dms = new Uint8Array(32);
  crypto.getRandomValues(dms);
  await memPut(dms);
  return dms;
}

export async function getDMS(): Promise<Uint8Array | null> {
  if (isBrowser()) return await dbGet();
  return await memGet();
}
