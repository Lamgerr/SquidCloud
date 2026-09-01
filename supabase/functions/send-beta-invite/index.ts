import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendEmail, emailShell, APP_URL, TEXT, TEXT_2, MUTED, BG, BORDER, MONO_STACK,
} from "../_shared/gmail-email.ts";

const BETA_URL = `${APP_URL}/beta/substrate`;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildBetaEmail(username: string): { subject: string; text: string; html: string } {
  const subject = "You're invited — SquidCloud's decentralized storage beta is here";

  const text = `Hey ${username},

We’re building something big.

SquidCloud is going substrate-agnostic — your encrypted chunks will soon find a home on the deepest, setup-free surfaces of the internet. No buckets to configure. No keys to paste. The network itself becomes the filesystem.

It runs alongside your existing B2/S3 storage, so nothing changes unless you opt in.

Tap below and you’re automatically enrolled. We’ll email you the moment the beta goes live.

Enroll now: ${BETA_URL}

— The SquidCloud Team`;

  const content = `
    <tr>
      <td style="padding:36px 40px 0 40px;">
        <span style="font-size:28px;font-weight:700;letter-spacing:-0.03em;color:${TEXT};line-height:1.15;">
          Storage that<br/>lives everywhere.
        </span>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 40px 0 40px;">
        <span style="font-size:16px;color:${TEXT_2};line-height:1.7;">
          Hey ${username} — we’re building a <span style="color:${TEXT};font-weight:600;">substrate-agnostic</span> layer for SquidCloud.
          Your encrypted chunks will soon find a home on the deepest, setup-free surfaces of the internet.
          No buckets to configure. No S3 keys to paste.
        </span>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:10px 0;"><span style="font-size:15px;color:${TEXT_2};">✦ Runs <span style="color:${TEXT};font-weight:600;">alongside</span> your existing B2/S3 storage — nothing breaks</span></td>
          </tr>
          <tr>
            <td style="padding:10px 0;"><span style="font-size:15px;color:${TEXT_2};">✦ <span style="color:${TEXT};font-weight:600;">Zero setup</span> — if you can reach the internet, you can store</span></td>
          </tr>
          <tr>
            <td style="padding:10px 0;"><span style="font-size:15px;color:${TEXT_2};">✦ Still <span style="color:${TEXT};font-weight:600;">zero-knowledge</span> — chunks stay self-encrypted, manifests stay encrypted too</span></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${TEXT}" style="border-radius:999px;">
              <a href="${BETA_URL}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;letter-spacing:0.02em;color:${BG};text-decoration:none;border-radius:999px;">Enroll in Beta →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 40px 0 40px;">
        <span style="font-size:13px;color:${MUTED};line-height:1.6;">One click and you’re in. You’ll be auto-enrolled and notified by email the moment the beta goes live. No code has shipped yet — your enrollment helps us prioritize.</span>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 40px 28px 40px;">
        <span style="font-size:12px;color:${MUTED};">Or paste this link: <a href="${BETA_URL}" style="color:${TEXT_2};word-break:break-all;">${BETA_URL}</a></span>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="height:1px;background:${BORDER};font-size:1px;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 40px 36px 40px;">
        <span style="font-size:13px;color:${MUTED};line-height:1.7;">
          Questions? Just reply to this email.<br/>
          <span style="font-family:${MONO_STACK};">— The SquidCloud Team</span>
        </span>
      </td>
    </tr>`;

  const html = emailShell(content, "Private Beta Invite");
  return { subject, text, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // Only service role can trigger broadcast
  const auth = req.headers.get("authorization") || "";
  if (!auth.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "___")) {
    const supabaseCheck = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user } } = await supabaseCheck.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));

  // Dry run preview
  if (body.preview) {
    const { subject, text, html } = buildBetaEmail("there");
    return new Response(JSON.stringify({ subject, text, htmlPreview: html.slice(0, 800) }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Single test email
  if (body.test_email) {
    const { subject, text, html } = buildBetaEmail(body.test_email.split("@")[0]);
    await sendEmail(body.test_email, subject, text, html);
    return new Response(JSON.stringify({ sent_to: body.test_email }), { headers: CORS });
  }

  // Broadcast to all auth.users (batched)
  const BATCH = 25;
  let offset = 0;
  let sent = 0;
  let failed = 0;
  const errors: unknown[] = [];
  const dryRun: boolean = body.dry_run === true;

  while (true) {
    const { data: users, error } = await supabase.auth.admin.listUsers({ page: Math.floor(offset / 50) + 1, perPage: 50 });
    if (error || !users?.users?.length) break;
    const batch = users.users.slice(offset % 50, offset % 50 + BATCH);
    if (!batch.length) { offset += BATCH; if (offset >= users.users.length && users.users.length < 50) break; continue; }

    for (const u of batch) {
      if (!u.email) continue;
      const name = u.user_metadata?.full_name || u.user_metadata?.user_name || u.email.split("@")[0];
      const { subject, text, html } = buildBetaEmail(name);
      if (dryRun) { sent++; continue; }
      try {
        await sendEmail(u.email, subject, text, html);
        sent++;
      } catch (e) {
        failed++;
        errors.push({ email: u.email, error: String(e).slice(0, 200) });
      }
      // Gentle throttle
      await new Promise(r => setTimeout(r, 120));
    }
    offset += batch.length;
    if (users.users.length < 50) break;
    if (offset > 5000) break;
  }

  return new Response(JSON.stringify({ sent, failed, errors: errors.slice(0, 5), dryRun }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
