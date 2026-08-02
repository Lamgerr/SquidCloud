import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSignal } from "../_shared/signals.ts";
import {
  sendEmail,
  buildReceiptEmailHtml,
  buildWelcomeEmailHtml,
  getDisplayName,
  emailShell,
  BG,
  BORDER,
  TEXT,
  TEXT_2,
  MUTED,
  MONO_STACK,
  APP_URL,
  type ReceiptParams,
} from "../_shared/gmail-email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function formatDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

function getPlanName(planType: string): string {
  return planType === 'supporter-plus' ? 'Supporter+' : 'Supporter';
}

// ═══════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES — Subscription Expiry & Win-back
// ═══════════════════════════════════════════════════════════════════

function cardDivider(): string {
  return `<tr><td style="padding:24px 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background-color:${BORDER};font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>`;
}

function ctaButton(href: string, text: string): string {
  return `<tr><td style="padding:0 40px 8px 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${TEXT}" style="border-radius:999px;"><a href="${href}" target="_blank" style="display:inline-block;padding:13px 32px;font-size:16px;font-weight:600;letter-spacing:0.01em;color:${BG};text-decoration:none;border-radius:999px;">${escapeHtml(text)}</a></td></tr></table></td></tr>`;
}

function secondaryLink(href: string, text: string): string {
  return `<tr><td align="center" style="padding:12px 40px 32px 40px;"><a href="${href}" target="_blank" style="font-size:14px;color:${MUTED};text-decoration:none;">${escapeHtml(text)}</a></td></tr>`;
}

function changeList(items: string[]): string {
  const rows = items
    .map(
      (i) => `<tr>
        <td width="24" style="padding:6px 0;"><span style="font-family:${MONO_STACK};font-size:14px;color:${MUTED};">−</span></td>
        <td style="padding:6px 0;"><span style="font-size:16px;color:${TEXT_2};">${escapeHtml(i)}</span></td>
      </tr>`,
    )
    .join("");
  return `<tr><td style="padding:0 40px 20px 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>`;
}

function buildStageEmailHtml(
  planType: string,
  username: string,
  stage: number,
  billingPeriod: string,
  daysRemaining: number,
  expiresAt: string,
  upsellData?: { targetPlan?: string; targetBilling?: string; savings?: string; bonusDays?: number }
): string {
  const planName = getPlanName(planType);
  const expiryDateOnly = formatDate(expiresAt);
  const label = billingPeriod.charAt(0).toUpperCase() + billingPeriod.slice(1);

  const title =
    stage >= 4
      ? "Your plan has ended"
      : daysRemaining > 0
        ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
        : "Plan ended";

  const rows: string[] = [
    `<tr><td style="padding:34px 40px 0 40px;"><span style="font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT};">${escapeHtml(title)}</span></td></tr>`,
    `<tr><td style="padding:10px 40px 0 40px;"><span style="font-size:16px;color:${TEXT_2};">${escapeHtml(planName)} · ${label} plan</span></td></tr>`,
    cardDivider(),
    `<tr><td style="padding:0 40px 8px 40px;"><span style="font-size:17px;color:${TEXT_2};line-height:1.8;">Hi ${escapeHtml(username)},</span></td></tr>`,
  ];

  const isLastDay = (billingPeriod === 'weekly' && stage === 3) ||
                    (billingPeriod === 'monthly' && stage === 4) ||
                    (billingPeriod === 'annual' && stage === 5);

  if (daysRemaining > 0) {
    rows.push(
      `<tr><td style="padding:0 40px 24px 40px;"><span style="font-size:17px;color:${TEXT_2};line-height:1.8;">Your <strong style="color:${TEXT};">${escapeHtml(planName)}</strong> subscription ${isLastDay ? "expires today" : `expires on <strong style="color:${TEXT};">${escapeHtml(expiryDateOnly)}</strong>`}. Your benefits continue until then.</span></td></tr>`,
    );
    if (isLastDay) {
      rows.push(changeList([
        "Sites may enter the 50-day archive countdown",
        "Priority queue access ends",
        "Max upload file size drops to 1 GB",
        "API tokens drop to 1,000 per day",
      ]));
    }
    rows.push(ctaButton(`${APP_URL}/checkout?plan=${planType}&billing=${billingPeriod}`, isLastDay ? "Renew my subscription" : "Manage subscription"));
    rows.push(secondaryLink(`${APP_URL}/settings/account?tab=preferences`, "Update notification preferences"));
  } else {
    rows.push(
      `<tr><td style="padding:0 40px 24px 40px;"><span style="font-size:17px;color:${TEXT_2};line-height:1.8;">Your <strong style="color:${TEXT};">${escapeHtml(planName)}</strong> subscription ended on <strong style="color:${TEXT};">${escapeHtml(expiryDateOnly)}</strong>. Your account is now on the Free plan.</span></td></tr>`,
    );
    rows.push(changeList([
      "Sites may enter the 50-day archive countdown",
      "Priority queue access ends",
      "Max upload file size drops to 1 GB",
      "API tokens drop to 1,000 per day",
      "Supporter badge removed from profile",
    ]));
    rows.push(ctaButton(`${APP_URL}/checkout?plan=${planType}&billing=${billingPeriod === 'annual' ? 'annual' : 'monthly'}`, `Reactivate ${escapeHtml(planName)}`));
    rows.push(secondaryLink(`${APP_URL}/settings/account?tab=preferences`, "Update notification preferences"));
  }

  const footerExtra =
    `<a href="${APP_URL}/settings/account?tab=preferences" style="color:${MUTED};text-decoration:underline;">Manage notification preferences</a>`;

  return emailShell(rows.join("\n"), "Subscription", undefined, footerExtra);
}

// ═══════════════════════════════════════════════════════════════════
// CRON HANDLER — Check all subscriptions and trigger notifications
// ═══════════════════════════════════════════════════════════════════

async function handleCron(supabase: ReturnType<typeof createClient>, dryRun = false) {
  const results: {
    checked: number; emails_triggered: number; popups_triggered: number;
    banners_triggered: number; errors: string[]; upsells_offered: number;
  } = { checked: 0, emails_triggered: 0, popups_triggered: 0, banners_triggered: 0, errors: [], upsells_offered: 0 };

  const { data: subs, error } = await supabase.rpc('get_subscriptions_needing_notifications');
  if (error) return json({ error: error.message }, 500);

  results.checked = subs?.length || 0;

  for (const sub of (subs || [])) {
    try {
      const { user_id, email, full_name, plan_type, billing_period, days_remaining, days_since_expiry, current_stage, max_stage } = sub;
      if (current_stage === 0 || current_stage >= 99) continue;
      if (!email) continue;

      const { data: prefs } = await supabase
        .from('user_notification_prefs')
        .select('*')
        .eq('user_id', user_id)
        .maybeSingle();

      if (prefs?.do_not_contact && current_stage >= 4) continue;

      const username = full_name || email.split('@')[0] || 'there';

      // Determine which notification types to trigger for this stage
      const stagesToTrigger: Array<{ type: string; stage: number }> = [];

      const isPostExpiry = current_stage >= 4;
      const isLastDay = (billing_period === 'weekly' && current_stage === 3) ||
                        (billing_period === 'monthly' && current_stage === 4) ||
                        (billing_period === 'annual' && current_stage === 5);

      // Map stage to notification types
      if (!isPostExpiry && !isLastDay) {
        // Pre-expiry warning stages: email + banner
        if (prefs?.email_enabled !== false) stagesToTrigger.push({ type: 'email', stage: current_stage });
        stagesToTrigger.push({ type: 'banner', stage: current_stage });
      } else if (isLastDay) {
        // Last day: email + popup
        if (prefs?.email_enabled !== false) stagesToTrigger.push({ type: 'email', stage: current_stage });
        if (prefs?.popup_enabled !== false) stagesToTrigger.push({ type: 'popup', stage: current_stage });
      } else if (isPostExpiry) {
        // Post-expiry: email only (popup shown on app load)
        if (prefs?.email_enabled !== false && prefs?.do_not_contact !== true) {
          stagesToTrigger.push({ type: 'email', stage: current_stage });
        }
      }

      // Upsell check: weekly stage 2 or monthly stage 3 or annual stage 4
      const isUpsellStage = (billing_period === 'weekly' && current_stage === 2) ||
                            (billing_period === 'monthly' && current_stage === 3) ||
                            (billing_period === 'annual' && current_stage === 4);

      for (const { type, stage } of stagesToTrigger) {
        if (dryRun) {
          if (type === 'email') results.emails_triggered++;
          if (type === 'popup') results.popups_triggered++;
          if (type === 'banner') results.banners_triggered++;
          continue;
        }

        const { data: triggered } = await supabase.rpc('ensure_notification_triggered', {
          p_user_id: user_id,
          p_stage: stage,
          p_notification_type: type,
          p_plan_type: plan_type,
          p_billing_period: billing_period,
        });

        if (!triggered) continue; // Already triggered

        if (type === 'banner' || type === 'popup') {
          const days = days_remaining ?? 0;
          void sendSignal({
            service_id: 'cloudbliss',
            user_id,
            type: 'subscription_expiring',
            severity: isPostExpiry ? 'urgent' : 'warning',
            title: isPostExpiry ? 'Subscription expired' : 'Subscription expiring soon',
            body: isPostExpiry
              ? 'Your premium plan has ended. Renew to keep your features active.'
              : days > 0
              ? `Your ${plan_type} plan expires in ${days} day${days === 1 ? '' : 's'}.`
              : `Your ${plan_type} plan is about to expire.`,
            link: '/checkout',
            idempotency_key: `subscription_expiring:${user_id}:${stage}`,
          });
        }

        if (type === 'email') {
          results.emails_triggered++;
          const subject = buildSubject(plan_type, billing_period, stage, username, days_remaining);
          const textBody = buildTextBody(plan_type, billing_period, stage, username, days_remaining, days_since_expiry);
          const htmlBody = buildStageEmailHtml(plan_type, username, stage, billing_period, days_remaining, sub.subscription_expires_at?.toISOString?.() || sub.subscription_expires_at);

          try {
            await sendEmail(email, subject, textBody, htmlBody);
            await supabase.from('subscription_events').insert({
              user_id, event_type: 'email_sent', plan_type, billing_period,
              metadata: { email_type: 'subscription_stage', stage, subject, recipient: email },
            }).maybeSingle();
          } catch (e) {
            console.error(`Failed to send stage ${stage} email to ${user_id}:`, e);
            results.errors.push(`Email failed for ${user_id} stage ${stage}`);
          }
        }

        if (type === 'popup') {
          results.popups_triggered++;
          // Upsell popup tracking
          if (isUpsellStage) {
            await supabase.from('subscription_notifications').update({
              upsell_offer_shown: true,
            }).eq('user_id', user_id).eq('stage', stage).eq('notification_type', 'popup');
            results.upsells_offered++;
          }
        }

        if (type === 'banner') results.banners_triggered++;
      }

      // Handle upsell tracking for popup notifications
      if (isUpsellStage && prefs?.popup_enabled !== false) {
        const { data: existingPopup } = await supabase.rpc('ensure_notification_triggered', {
          p_user_id: user_id, p_stage: current_stage,
          p_notification_type: 'popup',
          p_plan_type: plan_type, p_billing_period: billing_period,
        });
      }

    } catch (e: any) {
      console.error(`Error processing subscription ${sub?.user_id}:`, e);
      results.errors.push(`Error for ${sub?.user_id}: ${e.message}`);
    }
  }

  return json({ success: true, dry_run: dryRun, results });
}

function buildSubject(planType: string, billingPeriod: string, stage: number, username: string, daysRemaining: number): string {
  const planName = getPlanName(planType);

  const subjects: Record<string, Record<number, string>> = {
    weekly: {
      1: `Your ${planName} subscription renews in 7 days`,
      2: `Your ${planName} subscription renews tomorrow`,
      3: `Your ${planName} subscription expires today`,
      5: `Your ${planName} subscription has ended`,
      6: `Your ${planName} subscription has ended`,
    },
    monthly: {
      1: `Your ${planName} subscription renews in ${daysRemaining} days`,
      2: `Your ${planName} subscription renews soon`,
      3: `${daysRemaining} days remaining on your ${planName} subscription`,
      4: `Your ${planName} subscription expires tomorrow`,
      6: `Your ${planName} subscription has ended`,
      7: `Your ${planName} subscription has ended`,
      8: `Your ${planName} subscription has ended`,
    },
    annual: {
      1: `Your ${planName} subscription renews in 30 days`,
      2: `Your ${planName} subscription renews in 15 days`,
      3: `Your ${planName} subscription renews in 7 days`,
      4: `3 days remaining on your ${planName} subscription`,
      5: `Your ${planName} subscription expires tomorrow`,
      7: `Your ${planName} subscription has ended`,
      8: `Your ${planName} subscription has ended`,
      9: `Your ${planName} subscription has ended`,
    },
  };

  return subjects[billingPeriod]?.[stage] || `Your ${planName} subscription status`;
}

function buildTextBody(planType: string, billingPeriod: string, stage: number, username: string, daysRemaining: number, daysSinceExpiry: number): string {
  const planName = getPlanName(planType);
  if (daysRemaining > 0) {
    return `Hi ${username}, your ${planName} subscription has ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining. Manage your subscription at https://squidcloud.vercel.app/checkout?plan=${planType}&billing=${billingPeriod}`;
  }
  return `Hi ${username}, your ${planName} subscription ended ${daysSinceExpiry} day${daysSinceExpiry === 1 ? '' : 's'} ago. Renew at https://squidcloud.vercel.app/checkout?plan=${planType}&billing=${billingPeriod === 'annual' ? 'annual' : 'monthly'}`;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? '';
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/subscription-manager\//, '');

  const authHeader = req.headers.get('Authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
  const isServiceRole = bearerToken === serviceRoleKey;

  try {
    // ---- GET /status ----
    if (req.method === 'GET' && path === 'status') {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401);
      const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);
      const { data, error } = await supabase.rpc('check_subscription_validity', { user_id: user.id });
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    // ---- GET /limits ----
    if (req.method === 'GET' && (path === 'limits' || path === '')) {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401);
      const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);
      const { data, error } = await supabase.rpc('get_user_plan_limits', { user_id: user.id });
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    // ---- GET /events ----
    if (req.method === 'GET' && path === 'events') {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401);
      const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);
      const { data, error } = await supabase.from('subscription_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    // ---- GET /pending-notifications ----
    if (req.method === 'GET' && path === 'pending-notifications') {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401);
      const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);
      const { data, error } = await supabase.rpc('get_pending_notifications', { p_user_id: user.id });
      if (error) return json({ error: error.message }, 500);
      return json(data || []);
    }

    // ---- POST /dismiss-popup ----
    if (req.method === 'POST' && path === 'dismiss-popup') {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401);
      const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);
      const body = await req.json();
      const { notification_id } = body;
      if (!notification_id) return json({ error: 'notification_id required' }, 400);
      const { error } = await supabase.from('subscription_notifications').update({ dismissed: true }).eq('id', notification_id).eq('user_id', user.id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ---- POST /snooze-banner ----
    if (req.method === 'POST' && path === 'snooze-banner') {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401);
      const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);
      const body = await req.json();
      const { notification_id } = body;
      if (!notification_id) return json({ error: 'notification_id required' }, 400);
      const snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('subscription_notifications').update({ snoozed_until: snoozedUntil }).eq('id', notification_id).eq('user_id', user.id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, snoozed_until: snoozedUntil });
    }

    // ---- POST /accept-upsell ----
    if (req.method === 'POST' && path === 'accept-upsell') {
      if (!isServiceRole && !bearerToken) return json({ error: 'Unauthorized' }, 401);
      let userId: string;
      if (isServiceRole) {
        const body = await req.json();
        userId = body.user_id;
      } else {
        const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
        if (userError || !user) return json({ error: 'Unauthorized' }, 401);
        userId = user.id;
      }
      const body = await req.json();
      const { notification_id } = body;
      if (!notification_id) return json({ error: 'notification_id required' }, 400);
      const { error } = await supabase.from('subscription_notifications').update({ upsell_offer_accepted: true, clicked: true }).eq('id', notification_id).eq('user_id', userId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ---- POST /update-prefs ----
    if (req.method === 'POST' && path === 'update-prefs') {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401);
      const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);
      const body = await req.json();
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.email_enabled !== undefined) update.email_enabled = body.email_enabled;
      if (body.popup_enabled !== undefined) update.popup_enabled = body.popup_enabled;
      if (body.warning_lead_days !== undefined) update.warning_lead_days = body.warning_lead_days;
      if (body.do_not_contact !== undefined) update.do_not_contact = body.do_not_contact;
      const { error } = await supabase.from('user_notification_prefs').upsert({ user_id: user.id, ...update });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ---- POST /send-welcome-email ----
    if (req.method === 'POST' && path === 'send-welcome-email') {
      if (!isServiceRole) return json({ error: 'Unauthorized: service role required' }, 401);
      const body = await req.json();
      const { user_id, plan_type, expires_at, recipient_email } = body;
      if (!user_id || !plan_type) return json({ error: 'user_id and plan_type are required' }, 400);
      let email = recipient_email;
      if (!email) { const { data: au } = await supabase.auth.admin.getUserById(user_id); email = au?.user?.email || ''; }
      if (!email) return json({ error: 'User email not found' }, 400);
      const { data: profile } = await supabase.from('profiles').select('username, display_name, full_name').eq('id', user_id).maybeSingle();
      const username = getDisplayName(profile);
      const planName = getPlanName(plan_type);
      const subject = `Welcome to ${planName}! Your subscription is active, ${username}`;
      const htmlBody = buildWelcomeEmailHtml(plan_type, username, expires_at || new Date(Date.now() + 30 * 86400000).toISOString());
      const textBody = `Hey ${username}, welcome to ${planName}! Your subscription is active. Expires: ${expires_at || 'N/A'}.`;
      await sendEmail(email, subject, textBody, htmlBody);
      await supabase.from('subscription_events').insert({ user_id, event_type: 'email_sent', plan_type, metadata: { email_type: 'welcome', recipient: email } }).maybeSingle();
      return json({ success: true });
    }

    // ---- POST /send-billing-email ----
    if (req.method === 'POST' && path === 'send-billing-email') {
      if (!isServiceRole) return json({ error: 'Unauthorized: service role required' }, 401);
      const body = await req.json();
      const { user_id, plan_type, billing_period, amount_usd, discount_percent, discount_code, expires_at, recipient_email } = body;
      if (!user_id || !plan_type) return json({ error: 'user_id and plan_type are required' }, 400);
      const email = recipient_email;
      if (!email) return json({ error: 'User email not found' }, 400);
      const { data: profile } = await supabase.from('profiles').select('username, display_name, full_name').eq('id', user_id).maybeSingle();
      const username = getDisplayName(profile);
      const planName = getPlanName(plan_type);
      const subject = `Payment Successful — ${planName} ${billing_period || 'monthly'} Subscription`;
      const params: ReceiptParams = {
        username, userId: user_id, planType: plan_type,
        billingPeriod: billing_period || 'monthly',
        startsAt: new Date().toISOString(),
        expiresAt: expires_at || new Date(Date.now() + 30 * 86400000).toISOString(),
        amount: amount_usd || 0, currency: 'USD',
        paymentMode: discount_code ? 'discount code' : 'crypto',
        discountPercent: discount_percent || 0, discountCode: discount_code || '', txHash: '',
      };
      const htmlBody = buildReceiptEmailHtml(params);
      const textBody = `Hey ${username}, your ${planName} subscription is active. Total: $${(amount_usd || 0).toFixed(2)} USD. Active until ${expires_at || 'N/A'}.`;
      await sendEmail(email, subject, textBody, htmlBody);
      await supabase.from('subscription_events').insert({ user_id, event_type: 'email_sent', plan_type, metadata: { email_type: 'billing_invoice', recipient: email } }).maybeSingle();
      return json({ success: true });
    }

    // ---- POST /send-payment-failed-email ----
    if (req.method === 'POST' && path === 'send-payment-failed-email') {
      if (!isServiceRole) return json({ error: 'Unauthorized: service role required' }, 401);
      const body = await req.json();
      const { user_id, plan_type, error_detail, recipient_email } = body;
      if (!user_id || !plan_type) return json({ error: 'user_id and plan_type are required' }, 400);
      const email = recipient_email;
      if (!email) return json({ error: 'User email not found' }, 400);
      return json({ success: true });
    }

    // ---- POST /cron ----
    if (req.method === 'POST' && (path === 'cron' || path === 'check-expiry')) {
      if (!isServiceRole) return json({ error: 'Unauthorized: service role required' }, 401);
      return await handleCron(supabase, false);
    }

    // ---- POST /cron-dry-run ----
    if (req.method === 'POST' && path === 'cron-dry-run') {
      if (!isServiceRole) return json({ error: 'Unauthorized: service role required' }, 401);
      return await handleCron(supabase, true);
    }

    // ---- POST /activate ----
    if (req.method === 'POST' && path === 'activate') {
      const body = await req.json();
      const { user_id, plan_type, billing_period } = body;
      if (!user_id || !plan_type) return json({ error: 'user_id and plan_type are required' }, 400);

      if (!isServiceRole && bearerToken) {
        const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
        if (userError || !user || user.id !== user_id) return json({ error: 'Unauthorized' }, 401);
        const { data: recentPayment } = await supabase.from('payment_logs').select('id').eq('user_id', user_id).eq('status', 'completed').gte('created_at', new Date(Date.now() - 86400000).toISOString()).limit(1).maybeSingle();
        if (!recentPayment) return json({ error: 'No recent payment found for activation' }, 400);
      } else if (!isServiceRole && !bearerToken) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const now = new Date().toISOString();
      let expiresAt: Date;
      switch (billing_period) {
        case 'weekly': expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); break;
        case 'annual': expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); break;
        default: expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      const { error: updateError } = await supabase.from('profiles').update({
        is_premium: true, tier: plan_type, subscription_starts_at: now, subscription_expires_at: expiresAt.toISOString(), updated_at: now,
      }).eq('id', user_id);
      if (updateError) return json({ error: updateError.message }, 500);

      await supabase.from('subscription_events').insert({
        user_id, event_type: 'activated', plan_type, billing_period: billing_period || 'monthly',
        metadata: { source: isServiceRole ? 'webhook' : 'post-payment-activation', expires_at: expiresAt.toISOString() },
      }).maybeSingle();

      await supabase.from('payment_logs').insert({
        user_id, plan: plan_type, plan_type, billing_period: billing_period || 'monthly',
        status: 'completed',
        description: `Subscription activated — ${plan_type} ${billing_period || 'monthly'}${isServiceRole ? ' (via webhook)' : ' (post-payment)'}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        metadata: { source: isServiceRole ? 'webhook' : 'post-payment-activation', expires_at: expiresAt.toISOString() },
      });

      return json({ success: true, expires_at: expiresAt.toISOString() });
    }

    return json({ error: 'Not found' }, 404);

  } catch (err: any) {
    console.error('subscription-manager error:', err);
    return json({ error: err.message || 'Internal error' }, 500);
  }
});
