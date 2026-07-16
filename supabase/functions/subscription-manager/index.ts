import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendEmail,
  buildReceiptEmailHtml,
  buildWelcomeEmailHtml,
  getDisplayName,
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
  const expiryDate = formatDateTime(expiresAt);
  const expiryDateOnly = formatDate(expiresAt);

  const contentBlocks: string[] = [];

  // --- WEEKLY STAGE 2: Upsell offer ---
  if (billingPeriod === 'weekly' && stage === 2) {
    contentBlocks.push(`
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">
        Your <strong>${escapeHtml(planName)}</strong> plan expires tomorrow at ${expiryDate.split(', ').slice(1).join(', ')}.
      </p>
      <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:12px;padding:20px;margin:0 0 20px;border:1px solid #f59e0b">
        <h2 style="margin:0 0 8px;color:#92400e;font-size:18px">Switch to monthly today — get 10 extra days free</h2>
        <p style="margin:0 0 12px;color:#78350f;font-size:14px">You have 1 day left on your weekly plan ($0.75 value). Switch to monthly now for $4.00. We'll add your remaining day PLUS 10 bonus days on top of your full month — giving you 41 days total for $4.</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr>
            <td style="width:50%;padding:10px;background:#fff8e7;border-radius:8px 0 0 8px;text-align:center;border:1px solid #fbbf24">
              <p style="margin:0;font-size:11px;color:#92400e;font-weight:600">STAY WEEKLY</p>
              <p style="margin:4px 0;font-size:16px;color:#78350f;font-weight:700">$0.75/week</p>
              <p style="margin:0;font-size:11px;color:#92400e">~$3.26/mo equivalent</p>
              <p style="margin:0;font-size:11px;color:#92400e">No bonus days</p>
            </td>
            <td style="width:50%;padding:10px;background:#fefce8;border-radius:0 8px 8px 0;text-align:center;border:2px solid #6366f1;position:relative">
              <span style="position:absolute;top:-8px;right:8px;background:#6366f1;color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px">RECOMMENDED</span>
              <p style="margin:0;font-size:11px;color:#4f46e5;font-weight:600">SWITCH MONTHLY</p>
              <p style="margin:4px 0;font-size:16px;color:#4338ca;font-weight:700">$4.00/month</p>
              <p style="margin:0;font-size:11px;color:#4f46e5">~$0.92/week equivalent</p>
              <p style="margin:0;font-size:11px;color:#7c3aed;font-weight:600">+ 10 BONUS DAYS</p>
              <p style="margin:0;font-size:11px;color:#4f46e5">41 days total</p>
              <p style="margin:0;font-size:11px;color:#4f46e5">Save $3.50 vs weekly</p>
            </td>
          </tr>
        </table>
      </div>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 12px">
        <tr>
          <td><a href="https://squidcloud.vercel.app/checkout?plan=${planType}&billing=monthly&upsell=weekly_bonus" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600">Switch to Monthly — Get 10 Bonus Days</a></td>
        </tr>
      </table>
      <p style="margin:0 0 20px;text-align:center">
        <a href="https://squidcloud.vercel.app/checkout?plan=${planType}&billing=weekly" style="color:#6b7280;font-size:13px">Just renew weekly for $0.75</a>
      </p>
    `);
  }

  // --- WEEKLY STAGE 3: Final day ---
  if (billingPeriod === 'weekly' && stage === 3) {
    contentBlocks.push(`
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">
        Your <strong>${escapeHtml(planName)}</strong> plan expires <strong>today</strong> at ${expiryDate.split(', ').slice(1).join(', ')}.
      </p>
      <div style="background:#fef3c7;border-radius:8px;padding:14px;margin:0 0 16px;border-left:4px solid #f59e0b">
        <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5">
          <strong>When it expires:</strong><br>
          • Sites may enter the 50-day archive countdown<br>
          • Priority queue access ends<br>
          • File size limit drops to 1GB<br>
          • API tokens drop to 1,000/day
        </p>
      </div>
    `);
    if (upsellData?.bonusDays) {
      contentBlocks.push(`
        <p style="margin:0 0 16px;color:#374151;font-size:14px">Special offer still available — switch to monthly and get ${upsellData.bonusDays} bonus days.</p>
      `);
    }
    contentBlocks.push(`
      <table cellpadding="0" cellspacing="0" style="margin:0 auto">
        <tr>
          <td><a href="https://squidcloud.vercel.app/checkout?plan=${planType}&billing=${billingPeriod}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600">Keep my Supporter benefits</a></td>
        </tr>
      </table>
    `);
  }

  // --- MONTHLY STAGE 3: Annual upsell ---
  if (billingPeriod === 'monthly' && stage === 3) {
    contentBlocks.push(`
      <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6">
        Your <strong>${escapeHtml(planName)}</strong> plan renews in <strong>${daysRemaining} days</strong>.
      </p>
      <div style="background:linear-gradient(135deg,#e0e7ff,#c7d2fe);border-radius:12px;padding:20px;margin:12px 0 20px;border:1px solid #818cf8">
        <h2 style="margin:0 0 8px;color:#3730a3;font-size:18px">Lock in 4 months free by switching to annual</h2>
        <p style="margin:0 0 8px;color:#4338ca;font-size:14px">
          You're currently paying $4/month = $48/year.<br>
          Switch to annual today and pay just $32/year.<br>
          You save <strong>$16 every year</strong> — that's <strong>4 months completely free</strong>.
        </p>
        <p style="margin:0;color:#4338ca;font-size:13px">Your current billing period's remaining days carry over.</p>
      </div>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 10px">
        <tr>
          <td><a href="https://squidcloud.vercel.app/checkout?plan=${planType}&billing=annual&upsell=monthly_to_annual" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600">Switch to Annual — Save $16/yr</a></td>
        </tr>
      </table>
      <p style="margin:0;text-align:center"><a href="https://squidcloud.vercel.app/checkout?plan=${planType}&billing=monthly" style="color:#6b7280;font-size:13px">Keep my monthly plan</a></p>
    `);
  }

  // --- ANNUAL STAGE 3: Supporter+ upsell ---
  if (billingPeriod === 'annual' && stage === 3 && planType !== 'supporter-plus') {
    contentBlocks.push(`
      <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6">
        Your <strong>${escapeHtml(planName)}</strong> plan renews in <strong>${daysRemaining} days</strong>.
      </p>
      <div style="background:linear-gradient(135deg,#f3e8ff,#e9d5ff);border-radius:12px;padding:20px;margin:12px 0 20px;border:1px solid #a855f7">
        <h2 style="margin:0 0 8px;color:#6b21a8;font-size:18px">Upgrade to Supporter+ at renewal — unlimited everything</h2>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr>
            <th style="text-align:left;padding:6px 8px;font-size:12px;color:#6b21a8;border-bottom:1px solid #d8b4fe">Feature</th>
            <th style="text-align:center;padding:6px 8px;font-size:11px;color:#6b21a8;border-bottom:1px solid #d8b4fe">Supporter</th>
            <th style="text-align:center;padding:6px 8px;font-size:11px;color:#7c3aed;border-bottom:1px solid #d8b4fe;font-weight:700">Supporter+</th>
          </tr>
          <tr><td style="padding:5px 8px;font-size:12px;color:#374151">Concurrent uploads</td><td style="text-align:center;font-size:12px;color:#6b7280">10</td><td style="text-align:center;font-size:12px;color:#7c3aed;font-weight:600">Unlimited</td></tr>
          <tr><td style="padding:5px 8px;font-size:12px;color:#374151">Concurrent downloads</td><td style="text-align:center;font-size:12px;color:#6b7280">10</td><td style="text-align:center;font-size:12px;color:#7c3aed;font-weight:600">Unlimited</td></tr>
          <tr><td style="padding:5px 8px;font-size:12px;color:#374151">File size limit</td><td style="text-align:center;font-size:12px;color:#6b7280">12GB</td><td style="text-align:center;font-size:12px;color:#7c3aed;font-weight:600">Unlimited</td></tr>
          <tr><td style="padding:5px 8px;font-size:12px;color:#374151">API tokens/day</td><td style="text-align:center;font-size:12px;color:#6b7280">10,000</td><td style="text-align:center;font-size:12px;color:#7c3aed;font-weight:600">Unlimited</td></tr>
          <tr><td style="padding:5px 8px;font-size:12px;color:#374151">Queue priority</td><td style="text-align:center;font-size:12px;color:#6b7280">Priority</td><td style="text-align:center;font-size:12px;color:#7c3aed;font-weight:600">Top Priority</td></tr>
        </table>
        <p style="margin:8px 0 0;color:#4338ca;font-size:13px">
          <strong>Price difference: $48/year = $4/month extra</strong><br>
          For truly unlimited everything.
        </p>
      </div>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 10px">
        <tr>
          <td><a href="https://squidcloud.vercel.app/checkout?plan=supporter-plus&billing=annual&upsell=supporter_to_plus" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#a855f7,#d946ef);color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600">Upgrade to Supporter+ at renewal</a></td>
        </tr>
      </table>
      <p style="margin:0;text-align:center"><a href="https://squidcloud.vercel.app/checkout?plan=supporter&billing=annual" style="color:#6b7280;font-size:13px">Keep my current Supporter plan</a></p>
    `);
  }

  // --- MONTHLY STAGE 6 / WEEKLY STAGE 5 / ANNUAL STAGE 7: Post-expiry win-back ---
  if ((billingPeriod === 'weekly' && stage === 5) || (billingPeriod === 'monthly' && stage === 6) || (billingPeriod === 'annual' && stage === 7)) {
    contentBlocks.push(`
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6">
        Your <strong>${escapeHtml(planName)}</strong> plan has ended. You're now on the free plan.
      </p>
      <div style="background:#fef3c7;border-radius:8px;padding:14px;margin:0 0 16px;border-left:4px solid #f59e0b">
        <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5">
          <strong>What changed:</strong><br>
          • Priority queue — now standard queue<br>
          • Always-active sites — 50-day archive timer started<br>
          • File size limit dropped to 1GB<br>
          • API tokens reduced to 1,000/day<br>
          • Supporter badge removed from profile
        </p>
      </div>
    `);
    if (billingPeriod === 'annual') {
      contentBlocks.push(`
        <p style="margin:0 0 16px;color:#374151;font-size:14px;font-style:italic">
          You've been a supporter for a full year — thank you. We'd love to have you back.
        </p>
      `);
    }
    contentBlocks.push(`
      <table cellpadding="0" cellspacing="0" style="margin:0 auto">
        <tr>
          <td><a href="https://squidcloud.vercel.app/checkout?plan=${planType}&billing=${billingPeriod === 'annual' ? 'annual' : 'monthly'}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600">Reactivate ${escapeHtml(planName)} — from $${billingPeriod === 'annual' ? '32' : '4'}/mo</a></td>
        </tr>
      </table>
    `);
  }

  // --- Generic stage content for simple warning emails ---
  if (contentBlocks.length === 0) {
    contentBlocks.push(`
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6">
        Your <strong>${escapeHtml(planName)}</strong> plan ${daysRemaining > 0 ? `expires in <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>` : 'has expired'}.
      </p>
      <p style="margin:0 0 20px;color:#6b7280;font-size:14px">
        ${daysRemaining > 0 ? `Your current benefits continue until ${expiryDateOnly}.` : `Your account has been reverted to the Free plan.`}
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto">
        <tr>
          <td><a href="https://squidcloud.vercel.app/pricing" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">${daysRemaining > 0 ? 'Manage my subscription' : 'View Plans'}</a></td>
        </tr>
      </table>
    `);
  }

  const headerBg = stage >= 4 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)';
  const headerTitle = stage >= 4 ? 'Your plan has ended' : `${daysRemaining > 0 ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left` : 'Plan ended'}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <tr>
            <td style="background:${headerBg};padding:28px 32px;text-align:center">
              <h1 style="color:#ffffff;margin:0;font-size:20px">${escapeHtml(headerTitle)}</h1>
              <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px">${escapeHtml(planName)} — ${billingPeriod} plan</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px">
              <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6">
                Hey <strong>${escapeHtml(username)}</strong>,
              </p>
              ${contentBlocks.join('\n')}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
              <p style="margin:0;color:#9ca3af;font-size:11px">
                SquidCloud · <a href="https://squidcloud.vercel.app/settings/account?tab=preferences" style="color:#9ca3af;text-decoration:underline">Notification preferences</a> · <a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
  const name = username.split(' ')[0];

  const subjects: Record<string, Record<number, string>> = {
    weekly: {
      1: `Your ${planName} week is almost up, ${name}`,
      2: `1 day left — and here's a better deal, ${name}`,
      3: `Last chance — your benefits expire today`,
      5: `Your ${planName} benefits have ended, ${name}`,
      6: `${name}, we miss you — come back to ${planName}`,
    },
    monthly: {
      1: `Your ${planName} plan renews in ${daysRemaining} days`,
      2: `Your ${planName} plan renews soon`,
      3: `${daysRemaining} days left on your ${planName} plan`,
      4: `Your ${planName} plan expires tomorrow`,
      6: `You're back on the free plan, ${name}`,
      7: `${name}, your ${planName} benefits are waiting`,
      8: `Final chance — reactivate your ${planName} plan`,
    },
    annual: {
      1: `Your ${planName} plan renews in 30 days, ${name}`,
      2: `Your annual plan renews in 15 days`,
      3: `1 week until your annual plan renews`,
      4: `3 days left on your annual plan`,
      5: `Your annual plan expires tomorrow`,
      7: `Your annual plan has ended — here's what changed`,
      8: `${name}, your annual benefits are waiting`,
      9: `Last chance to reactivate your annual plan`,
    },
  };

  return subjects[billingPeriod]?.[stage] || `Your ${planName} plan needs attention, ${name}`;
}

function buildTextBody(planType: string, billingPeriod: string, stage: number, username: string, daysRemaining: number, daysSinceExpiry: number): string {
  const planName = getPlanName(planType);
  if (daysRemaining > 0) {
    return `Hey ${username}, your ${planName} ${billingPeriod} plan has ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining. Manage your subscription at https://squidcloud.vercel.app/settings/account`;
  }
  return `Hey ${username}, your ${planName} plan ended ${daysSinceExpiry} day${daysSinceExpiry === 1 ? '' : 's'} ago. Reactivate at https://squidcloud.vercel.app/pricing`;
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
