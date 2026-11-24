import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendEmail, emailShell, APP_URL, TEXT, TEXT_2, MUTED, BG, BORDER, MONO_STACK,
} from "../_shared/gmail-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildDiwaliEmail(username: string): { subject: string; text: string; html: string } {
  const subject = "🪔 Happy Diwali from SquidCloud — a note of gratitude";

  const text = `Happy Diwali, ${username}! 🪔

May this Festival of Lights fill your life with warmth, joy, and endless brightness.

This Diwali, we want to pause and say something simple and sincere:

We are deeply grateful for you — for believing in SquidCloud, for trusting us with your files, your keys, and your workflows. Every upload, every shared link, every API call you make is a vote of confidence in what we're building, and it means the world to us.

Because of you, SquidCloud keeps growing — more secure, more resilient, more yours. We're committed to keeping your data private, encrypted, and in your control, today and every day.

Wishing you and your loved ones a Diwali full of light, prosperity, and happiness. May the year ahead bring you everything you're reaching for.

With warmth and gratitude,
The SquidCloud Team

Open your dashboard: ${APP_URL}/dashboard`;

  const content = `
    <tr>
      <td style="padding:40px 40px 0 40px;text-align:center;">
        <span style="font-size:46px;line-height:1;">🪔</span>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 40px 0 40px;text-align:center;">
        <span style="font-size:30px;font-weight:700;letter-spacing:-0.03em;color:${TEXT};line-height:1.15;">
          Happy Diwali,<br/>${escape(username)}.
        </span>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 40px 0 40px;text-align:center;">
        <span style="font-size:16px;color:${TEXT_2};line-height:1.7;">
          May the Festival of Lights fill your home with warmth, joy, and endless brightness.
        </span>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="height:1px;background:${BORDER};font-size:1px;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px 0 40px;">
        <span style="font-size:17px;color:${TEXT};line-height:1.8;font-weight:600;">
          A note of gratitude
        </span>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 40px 0 40px;">
        <span style="font-size:16px;color:${TEXT_2};line-height:1.8;">
          This Diwali, we want to pause and say something simple and sincere:
        </span>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};border:1px solid ${BORDER};border-radius:16px;">
          <tr>
            <td style="padding:24px 28px;">
              <span style="font-size:16px;color:${TEXT};line-height:1.8;font-style:italic;">
                "We are deeply grateful for you — for believing in SquidCloud, for trusting us with your files, your keys, and your workflows. Every upload, every shared link, every API call you make is a vote of confidence in what we're building, and it means the world to us."
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px 0 40px;">
        <span style="font-size:16px;color:${TEXT_2};line-height:1.8;">
          Because of you, SquidCloud keeps growing — more secure, more resilient, more yours. We're committed to keeping your data private, encrypted, and in your control, today and every day.
        </span>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="height:1px;background:${BORDER};font-size:1px;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px 0 40px;text-align:center;">
        <span style="font-size:15px;color:${TEXT_2};line-height:1.7;">
          Wishing you and your loved ones a Diwali full of light, prosperity, and happiness. May the year ahead bring you everything you're reaching for.
        </span>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${TEXT}" style="border-radius:999px;">
              <a href="${APP_URL}/dashboard" target="_blank" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:600;letter-spacing:0.01em;color:${BG};text-decoration:none;border-radius:999px;">Open your dashboard →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px 36px 40px;text-align:center;">
        <span style="font-size:13px;color:${MUTED};line-height:1.7;">
          With warmth and gratitude,<br/>
          <span style="font-family:${MONO_STACK};">— The SquidCloud Team</span>
        </span>
      </td>
    </tr>`;

  const html = emailShell(content, "Happy Diwali");
  return { subject, text, html };
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));

  if (body.preview) {
    const { subject, text, html } = buildDiwaliEmail("there");
    return new Response(JSON.stringify({ subject, text, htmlPreview: html.slice(0, 1200) }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (body.test_email) {
    const { subject, text, html } = buildDiwaliEmail(body.test_email.split("@")[0]);
    await sendEmail(body.test_email, subject, text, html);
    return new Response(JSON.stringify({ sent_to: body.test_email }), { headers: CORS });
  }

  const dryRun: boolean = body.dry_run === true;
  const startOffset: number = typeof body.offset === "number" ? body.offset : 0;
  const limit: number = typeof body.limit === "number" ? body.limit : 25;

  let sent = 0;
  let failed = 0;
  const errors: unknown[] = [];

  // Fetch all users once (paginated)
  const allUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data: users, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !users?.users?.length) break;
    allUsers.push(...users.users);
    if (users.users.length < 100) break;
    page++;
    if (allUsers.length > 5000) break;
  }

  const slice = allUsers.slice(startOffset, startOffset + limit);
  for (const u of slice) {
    if (!u.email) continue;
    const name = u.user_metadata?.full_name || u.user_metadata?.user_name || u.email.split("@")[0];
    const { subject, text, html } = buildDiwaliEmail(name);
    if (dryRun) { sent++; continue; }
    try {
      await sendEmail(u.email, subject, text, html);
      sent++;
    } catch (e) {
      failed++;
      errors.push({ email: u.email, error: String(e).slice(0, 200) });
    }
    await new Promise(r => setTimeout(r, 120));
  }

  return new Response(JSON.stringify({ sent, failed, errors: errors.slice(0, 10), dryRun, processed: slice.length, nextOffset: startOffset + slice.length, total: allUsers.length }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
