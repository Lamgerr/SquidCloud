import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

type AdminAuthPayload = {
  step: number;
  accessKey?: string;
  adminUserId?: string;
  adminPassword?: string;
  accessPurpose?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
  }
  return withPrelGateway(req, { functionId: 'admin-auth', operation: 'default' }, async (ctx: PrelContext) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceKey) {
      return jsonResponse({ error: "Missing SUPABASE_SERVICE_ROLE_KEY secret" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let payload: AdminAuthPayload;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON payload" }, 400);
    }

    const step = Number(payload.step);
    if (!Number.isFinite(step) || step < 1 || step > 4) {
      return jsonResponse({ error: "Invalid step" }, 400);
    }

    const logAccess = async (stepCompleted: number, success: boolean, reason: string) => {
      await supabase.from("admin_access_logs").insert({
        user_id: ctx.userId,
        access_purpose: reason,
        step_completed: stepCompleted,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent"),
        session_id: crypto.randomUUID(),
      });
      return success;
    };

    if (step === 1) {
      const expectedKey = Deno.env.get("ADMIN_ACCESS_KEY");
      if (!expectedKey) {
        return jsonResponse({ error: "Missing ADMIN_ACCESS_KEY secret" }, 500);
      }

      if (!payload.accessKey || payload.accessKey !== expectedKey) {
        await logAccess(1, false, "Failed access key verification");
        return jsonResponse({ success: false, message: "Invalid access key" }, 403);
      }

      await logAccess(1, true, "Passed access key verification");
      return jsonResponse({ success: true });
    }

    if (step === 2) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", ctx.userId)
        .single();

      if (!profile?.is_admin) {
        await logAccess(2, false, "Failed admin privilege check");
        return jsonResponse({ success: false, message: "Admin privileges required" }, 403);
      }

      await logAccess(2, true, "Passed admin privilege check");
      return jsonResponse({ success: true });
    }

    if (step === 3) {
      const expectedAdminUser = Deno.env.get("ADMIN_USER_ID");
      const expectedAdminPassword = Deno.env.get("ADMIN_PASSWORD");
      const missingSecrets = [
        ...(expectedAdminUser ? [] : ["ADMIN_USER_ID"]),
        ...(expectedAdminPassword ? [] : ["ADMIN_PASSWORD"]),
      ];
      if (missingSecrets.length) {
        const secretWord = missingSecrets.length === 1 ? "secret" : "secrets";
        return jsonResponse({ error: `Missing ${missingSecrets.join(", ")} ${secretWord}` }, 500);
      }

      if (
        !payload.adminUserId ||
        !payload.adminPassword ||
        payload.adminUserId !== expectedAdminUser ||
        payload.adminPassword !== expectedAdminPassword
      ) {
        await logAccess(3, false, "Failed admin credentials verification");
        return jsonResponse({ success: false, message: "Invalid admin credentials" }, 403);
      }

      await logAccess(3, true, "Passed admin credentials verification");
      return jsonResponse({ success: true });
    }

    const accessPurpose = payload.accessPurpose?.trim();
    if (!accessPurpose) {
      return jsonResponse({ success: false, message: "Access purpose required" }, 400);
    }

    await logAccess(4, true, accessPurpose);
    return jsonResponse({ success: true, verified: true });
  });
});
