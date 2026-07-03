import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendEmail,
  buildReceiptEmailHtml,
  buildWelcomeEmailHtml,
  getDisplayName,
  type ReceiptParams,
} from "./gmail-email.ts";

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

// ---- EMAIL TEMPLATES (inline, unique to subscription-manager) ----

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildExpiryWarningEmailHtml(planType: string, username: string, expiresAt: string, daysRemaining: number): string {
  const planName = planType === "supporter-plus" ? "Supporter+" : "Supporter";
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px;text-align:center">
              <h1 style="color:#ffffff;margin:0;font-size:22px">Subscription Expiring Soon</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6">
                Hey <strong>${escapeHtml(username)}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">
                Your <strong>${escapeHtml(planName)}</strong> subscription will expire on <strong>${escapeHtml(expiryDate)}</strong>
                (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining).
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
                After expiry, your account will revert to the Free plan with limited features.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:24px auto 0">
                <tr>
                  <td>
                    <a href="https://squidcloud.vercel.app/pricing" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">
                      Renew Now
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
              <p style="margin:0;color:#9ca3af;font-size:11px">SquidCloud</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildExpiredEmailHtml(planType: string, username: string): string {
  const planName = planType === "supporter-plus" ? "Supporter+" : "Supporter";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <tr>
            <td style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px;text-align:center">
              <h1 style="color:#ffffff;margin:0;font-size:22px">Subscription Expired</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6">
                Hey <strong>${escapeHtml(username)}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">
                Your <strong>${escapeHtml(planName)}</strong> subscription has expired. Your account has been reverted to the Free plan.
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
                Upgrade again anytime to regain access to premium features.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:24px auto 0">
                <tr>
                  <td>
                    <a href="https://squidcloud.vercel.app/pricing" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">
                      View Plans
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
              <p style="margin:0;color:#9ca3af;font-size:11px">SquidCloud</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPaymentFailedEmailHtml(planType: string, username: string, errorDetail: string): string {
  const planName = planType === "supporter-plus" ? "Supporter+" : "Supporter";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <tr>
            <td style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px;text-align:center">
              <h1 style="color:#ffffff;margin:0;font-size:22px">Payment Failed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6">
                Hey <strong>${escapeHtml(username)}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">
                Your payment for the <strong>${escapeHtml(planName)}</strong> plan could not be processed.
              </p>
              <p style="margin:0 0 8px;color:#6b7280;font-size:14px">
                <strong>Reason:</strong> ${escapeHtml(errorDetail)}
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
                Please try again or use a different payment method.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:24px auto 0">
                <tr>
                  <td>
                    <a href="https://squidcloud.vercel.app/pricing" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">
                      Try Again
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
              <p style="margin:0;color:#9ca3af;font-size:11px">SquidCloud</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---- HELPER: get profile + send receipt for any activation path ----

async function sendActivationReceipt(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planType: string,
  billingPeriod: string,
  startsAt: string,
  expiresAt: string,
  amount: number,
  paymentMode: string,
) {
  const [profile, authUser] = await Promise.all([
    supabase.from('profiles').select('username, display_name, full_name, email').eq('id', userId).maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);
  const username = getDisplayName(profile.data);
  const recipientEmail = profile.data?.email || authUser.data?.user?.email || '';
  if (!recipientEmail) return;

  const planName = planType === "supporter-plus" ? "Supporter+" : "Supporter";

  const params: ReceiptParams = {
    username,
    userId,
    planType,
    billingPeriod,
    startsAt,
    expiresAt,
    amount,
    currency: 'USD',
    paymentMode,
    discountPercent: 0,
    discountCode: '',
    txHash: '',
  };

  try {
    const subject = `Payment Successful — ${planName} ${billingPeriod} Subscription`;
    const textBody = `Your ${planName} ${billingPeriod} subscription is active. Total: $${amount.toFixed(2)} USD.`;
    await sendEmail(recipientEmail, subject, textBody, buildReceiptEmailHtml(params));
    console.log('Activation receipt sent to', recipientEmail);
  } catch (e) {
    console.error('Failed to send activation receipt:', e);
  }

  try {
    const welcomeSubject = `Welcome to ${planName}! Your subscription is active, ${username}`;
    const welcomeText = `Hey ${username}, welcome to ${planName}! Your subscription is active until ${expiresAt}.`;
    await sendEmail(recipientEmail, welcomeSubject, welcomeText, buildWelcomeEmailHtml(planType, username, expiresAt));
  } catch (e) {
    console.error('Failed to send welcome email:', e);
  }
}

// ---- MAIN HANDLER ----

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? '';
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/functions\/v1\/subscription-manager/, '').replace(/^\/|\/$/g, '');

  const authHeader = req.headers.get('Authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
  const isServiceRole = bearerToken === serviceRoleKey;

  try {
    // ---- ROUTE: GET /status ----
    if (req.method === 'GET' && path === 'status') {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401);

      const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);

      const { data, error } = await supabase.rpc('check_subscription_validity', { user_id: user.id });
      if (error) return json({ error: error.message }, 500);

      return json(data);
    }

    if (req.method === 'GET' && (path === 'limits' || path === '')) {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401);

      const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);

      const { data, error } = await supabase.rpc('get_user_plan_limits', { user_id: user.id });
      if (error) return json({ error: error.message }, 500);

      return json(data);
    }

    // ---- ROUTE: POST /send-welcome-email ----
    if (req.method === 'POST' && path === 'send-welcome-email') {
      if (!isServiceRole) return json({ error: 'Unauthorized: service role required' }, 401);

      const body = await req.json();
      const { user_id, plan_type, expires_at, recipient_email } = body;

      if (!user_id || !plan_type) {
        return json({ error: 'user_id and plan_type are required' }, 400);
      }

      let email = recipient_email;
      if (!email) {
        const { data: au } = await supabase.auth.admin.getUserById(user_id);
        email = au?.user?.email || '';
      }
      if (!email) return json({ error: 'User email not found' }, 400);

      const { data: profile } = await supabase.from('profiles').select('username, display_name, full_name').eq('id', user_id).maybeSingle();
      const username = getDisplayName(profile);

      const planName = plan_type === "supporter-plus" ? "Supporter+" : "Supporter";
      const subject = `Welcome to ${planName}! Your subscription is active, ${username}`;
      const htmlBody = buildWelcomeEmailHtml(plan_type, username, expires_at || new Date(Date.now() + 30 * 86400000).toISOString());
      const textBody = `Hey ${username}, welcome to ${planName}! Your subscription is active. Expires: ${expires_at || 'N/A'}.`;

      await sendEmail(email, subject, textBody, htmlBody);

      await supabase.from('subscription_events').insert({
        user_id,
        event_type: 'email_sent',
        plan_type,
        metadata: { email_type: 'welcome', recipient: email },
      }).maybeSingle();

      return json({ success: true });
    }

    // ---- ROUTE: POST /send-payment-failed-email ----
    if (req.method === 'POST' && path === 'send-payment-failed-email') {
      if (!isServiceRole) return json({ error: 'Unauthorized: service role required' }, 401);

      const body = await req.json();
      const { user_id, plan_type, error_detail, recipient_email } = body;

      if (!user_id || !plan_type) {
        return json({ error: 'user_id and plan_type are required' }, 400);
      }

      const email = recipient_email;
      if (!email) return json({ error: 'User email not found' }, 400);

      const { data: profile } = await supabase.from('profiles').select('username, display_name, full_name').eq('id', user_id).maybeSingle();
      const username = getDisplayName(profile);

      const planName = plan_type === "supporter-plus" ? "Supporter+" : "Supporter";
      const subject = `Payment failed for ${planName}`;
      const htmlBody = buildPaymentFailedEmailHtml(plan_type, username, error_detail || 'Unknown error');
      const textBody = `Hey ${username}, your payment for ${planName} could not be processed. Reason: ${error_detail || 'Unknown'}`;

      await sendEmail(email, subject, textBody, htmlBody);

      await supabase.from('subscription_events').insert({
        user_id,
        event_type: 'email_sent',
        plan_type,
        metadata: { email_type: 'payment_failed', recipient: email },
      }).maybeSingle();

      return json({ success: true });
    }

    // ---- ROUTE: POST /send-billing-email ----
    if (req.method === 'POST' && path === 'send-billing-email') {
      if (!isServiceRole) return json({ error: 'Unauthorized: service role required' }, 401);

      const body = await req.json();
      const { user_id, plan_type, billing_period, amount_usd, discount_percent, discount_code, expires_at, recipient_email } = body;

      if (!user_id || !plan_type) {
        return json({ error: 'user_id and plan_type are required' }, 400);
      }

      const email = recipient_email;
      if (!email) return json({ error: 'User email not found' }, 400);

      const { data: profile } = await supabase.from('profiles').select('username, display_name, full_name').eq('id', user_id).maybeSingle();
      const username = getDisplayName(profile);

      const planName = plan_type === "supporter-plus" ? "Supporter+" : "Supporter";
      const subject = `Payment Successful — ${planName} ${billing_period || 'monthly'} Subscription`;

      const params: ReceiptParams = {
        username,
        userId: user_id,
        planType: plan_type,
        billingPeriod: billing_period || 'monthly',
        startsAt: new Date().toISOString(),
        expiresAt: expires_at || new Date(Date.now() + 30 * 86400000).toISOString(),
        amount: amount_usd || 0,
        currency: 'USD',
        paymentMode: discount_code ? 'discount code' : 'crypto',
        discountPercent: discount_percent || 0,
        discountCode: discount_code || '',
        txHash: '',
      };

      const htmlBody = buildReceiptEmailHtml(params);
      const textBody = `Hey ${username}, your ${planName} subscription is active. Total: $${(amount_usd || 0).toFixed(2)} USD. Active until ${expires_at || 'N/A'}.`;

      await sendEmail(email, subject, textBody, htmlBody);

      await supabase.from('subscription_events').insert({
        user_id,
        event_type: 'email_sent',
        plan_type,
        metadata: { email_type: 'billing_invoice', recipient: email },
      }).maybeSingle();

      return json({ success: true });
    }

    // ---- ROUTE: POST /check-expiry ----
    if (req.method === 'POST' && path === 'check-expiry') {
      if (!isServiceRole) return json({ error: 'Unauthorized: service role required' }, 401);

      const results: { notified_expiring?: number; notified_expired?: number } = {};
      const { data: expiringSoon, error: expiringError } = await supabase
        .rpc('get_users_with_expiring_subscriptions', { within_days: 7 });

      if (expiringError) {
        console.error('Error fetching expiring subscriptions:', expiringError);
      } else if (expiringSoon) {
        for (const user of expiringSoon) {
          try {
            const { data: profile } = await supabase.from('profiles').select('username, display_name, full_name').eq('id', user.user_id).maybeSingle();
            const username = getDisplayName(profile);

            const planName = user.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter';
            const subject = `Your ${planName} subscription expires in ${user.days_remaining} day${user.days_remaining === 1 ? '' : 's'}`;
            const htmlBody = buildExpiryWarningEmailHtml(user.tier, username, user.subscription_expires_at.toISOString(), user.days_remaining);
            const textBody = `Hey ${username}, your subscription expires in ${user.days_remaining} days. Renew now to avoid losing premium features.`;

            await sendEmail(user.email, subject, textBody, htmlBody);

            await supabase.from('subscription_events').insert({
              user_id: user.user_id,
              event_type: 'email_sent',
              plan_type: user.tier,
              metadata: {
                email_type: 'expiry_warning',
                days_remaining: user.days_remaining,
                expires_at: user.subscription_expires_at.toISOString(),
                recipient: user.email,
              },
            }).maybeSingle();

            results.notified_expiring = (results.notified_expiring || 0) + 1;
          } catch (e) {
            console.error(`Failed to send expiry warning to ${user.user_id}:`, e);
          }
        }
      }

      const { data: recentlyExpired, error: expiredError } = await supabase
        .rpc('get_users_with_recently_expired_subscriptions');

      if (expiredError) {
        console.error('Error fetching expired subscriptions:', expiredError);
      } else if (recentlyExpired) {
        for (const user of recentlyExpired) {
          try {
            const { data: profile } = await supabase.from('profiles').select('username, display_name, full_name').eq('id', user.user_id).maybeSingle();
            const username = getDisplayName(profile);

            const planName = user.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter';
            const subject = `Your ${planName} subscription has expired`;
            const htmlBody = buildExpiredEmailHtml(user.tier, username);
            const textBody = `Hey ${username}, your ${user.tier} subscription has expired. Your account has been reverted to Free.`;

            await sendEmail(user.email, subject, textBody, htmlBody);

            await supabase.from('subscription_events').insert({
              user_id: user.user_id,
              event_type: 'email_sent',
              plan_type: user.tier,
              metadata: {
                email_type: 'expired',
                expired_at: user.subscription_expires_at.toISOString(),
                recipient: user.email,
              },
            }).maybeSingle();

            await supabase.from('subscription_events').insert({
              user_id: user.user_id,
              event_type: 'expired',
              plan_type: user.tier,
              metadata: { expired_at: user.subscription_expires_at.toISOString() },
            }).maybeSingle();

            results.notified_expired = (results.notified_expired || 0) + 1;
          } catch (e) {
            console.error(`Failed to send expiry notification to ${user.user_id}:`, e);
          }
        }
      }

      return json({ success: true, results });
    }

    // ---- ROUTE: GET /events ----
    if (req.method === 'GET' && path === 'events') {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401);

      const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);

      const { data, error } = await supabase
        .from('subscription_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return json({ error: error.message }, 500);

      return json(data);
    }

    // ---- ROUTE: POST /activate ----
    if (req.method === 'POST' && path === 'activate') {
      const body = await req.json();
      const { user_id, plan_type, billing_period } = body;

      if (!user_id || !plan_type) {
        return json({ error: 'user_id and plan_type are required' }, 400);
      }

      if (isServiceRole) {
        // Service role: full access
      } else if (bearerToken) {
        const { data: { user }, error: userError } = await supabase.auth.getUser(bearerToken);
        if (userError || !user || user.id !== user_id) {
          return json({ error: 'Unauthorized' }, 401);
        }

        const { data: recentPayment } = await supabase
          .from('payment_logs')
          .select('id')
          .eq('user_id', user_id)
          .eq('status', 'completed')
          .gte('created_at', new Date(Date.now() - 86400000).toISOString())
          .limit(1)
          .maybeSingle();

        if (!recentPayment) {
          return json({ error: 'No recent payment found for activation' }, 400);
        }
      } else {
        return json({ error: 'Unauthorized' }, 401);
      }

      const now = new Date().toISOString();
      let expiresAt: Date;
      switch (billing_period) {
        case 'weekly':
          expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'annual':
          expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      const { error: updateError } = await supabase.from('profiles').update({
        is_premium: true,
        tier: plan_type,
        subscription_starts_at: now,
        subscription_expires_at: expiresAt.toISOString(),
        updated_at: now,
      }).eq('id', user_id);

      if (updateError) return json({ error: updateError.message }, 500);

      await supabase.from('subscription_events').insert({
        user_id,
        event_type: 'activated',
        plan_type,
        billing_period: billing_period || 'monthly',
        metadata: {
          source: isServiceRole ? 'webhook' : 'post-payment-activation',
          expires_at: expiresAt.toISOString(),
        },
      }).maybeSingle();

      await supabase.from('payment_logs').insert({
        user_id,
        plan: plan_type,
        plan_type,
        billing_period: billing_period || 'monthly',
        status: 'completed',
        description: `Subscription activated — ${plan_type} ${billing_period || 'monthly'}${isServiceRole ? ' (via webhook)' : ' (post-payment)'}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        metadata: {
          source: isServiceRole ? 'webhook' : 'post-payment-activation',
          expires_at: expiresAt.toISOString(),
        },
      });

      // Send receipt + welcome emails directly (not via HTTP to another route)
      if (isServiceRole) {
        await sendActivationReceipt(supabase, user_id, plan_type, billing_period || 'monthly', now, expiresAt.toISOString(), 0, 'crypto');
      }

      return json({ success: true, expires_at: expiresAt.toISOString() });
    }

    return json({ error: 'Not found' }, 404);

  } catch (err: any) {
    console.error('subscription-manager error:', err);
    return json({ error: err.message || 'Internal error' }, 500);
  }
});