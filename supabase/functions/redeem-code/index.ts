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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getExpiryDate(billingPeriod: string): Date {
  const now = new Date();
  switch (billingPeriod) {
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case 'annual': return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
}

function validateCode(code: any, userId: string): string | null {
  if (!code.is_active) return 'This code is no longer active';
  if (code.expires_at && new Date(code.expires_at) < new Date()) return 'This code has expired';
  if (code.max_uses && code.used_count >= code.max_uses) return 'This code has reached its maximum uses';
  if (code.for_user_id && code.for_user_id !== userId) return 'This code is assigned to a different user';
  return null;
}

async function activatePlan(supabase: any, userId: string, planType: string, billingPeriod: string, now: string, expiryDate: string) {
  const { error: updateProfileError } = await supabase
    .from('profiles')
    .update({
      is_premium: true,
      tier: planType,
      subscription_starts_at: now,
      subscription_expires_at: expiryDate,
      updated_at: now,
    })
    .eq('id', userId);

  if (updateProfileError) throw new Error('Failed to update profile');
}

async function sendEmails(
  supabase: any,
  userId: string,
  planType: string,
  billingPeriod: string,
  startsAt: string,
  expiresAt: string,
  amount: number,
  discountPercent: number,
  discountCode: string,
  authEmail?: string,
) {
  const { data: profile } = await supabase.from('profiles').select('username, display_name, full_name').eq('id', userId).maybeSingle();
  const username = getDisplayName(profile);
  const recipientEmail = authEmail || profile?.email || '';

  if (!recipientEmail) {
    console.warn('No email found for user, skipping emails');
    return;
  }

  const planName = planType === "supporter-plus" ? "Supporter+" : "Supporter";

  // Welcome email
  try {
    const welcomeSubject = `Welcome to ${planName}! Your subscription is active, ${username}`;
    const welcomeText = `Hey ${username}, welcome to ${planName}! Your subscription is active until ${expiresAt}.`;
    await sendEmail(recipientEmail, welcomeSubject, welcomeText, buildWelcomeEmailHtml(planType, username, expiresAt));
  } catch (e) {
    console.error('Failed to send welcome email:', e);
  }

  // Receipt email
  try {
    const receiptSubject = `Payment Successful — ${planName} ${billingPeriod} Subscription`;
    const receiptText = `Your ${planName} ${billingPeriod} subscription is active. Total: $${amount.toFixed(2)} USD.`;
    const receiptParams: ReceiptParams = {
      username,
      userId,
      planType,
      billingPeriod,
      startsAt,
      expiresAt,
      amount,
      currency: 'USD',
      paymentMode: discountCode ? 'discount code' : 'none',
      discountPercent,
      discountCode,
      txHash: '',
    };
    await sendEmail(recipientEmail, receiptSubject, receiptText, buildReceiptEmailHtml(receiptParams));
  } catch (e) {
    console.error('Failed to send receipt email:', e);
  }
}

// ---- MAIN HANDLER ----

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: { code?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.code || typeof body.code !== 'string') {
      return new Response(JSON.stringify({ error: 'Code is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = body.code.trim().toUpperCase();
    const now = new Date().toISOString();

    // Try redeem_codes first
    const { data: redeemCode } = await supabase
      .from('redeem_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (redeemCode) {
      const validationError = validateCode(redeemCode, user.id);
      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const expiryDate = getExpiryDate(redeemCode.billing_period).toISOString();
      await activatePlan(supabase, user.id, redeemCode.plan_type, redeemCode.billing_period, now, expiryDate);

      await supabase
        .from('redeem_codes')
        .update({
          used_count: (redeemCode.used_count || 0) + 1,
          for_user_id: redeemCode.for_user_id || user.id,
        })
        .eq('id', redeemCode.id);

      await supabase.from('subscription_events').insert({
        user_id: user.id,
        event_type: 'redeemed',
        plan_type: redeemCode.plan_type,
        billing_period: redeemCode.billing_period,
        metadata: { code_id: redeemCode.id, code: redeemCode.code, expires_at: expiryDate },
      }).maybeSingle();

      await supabase.from('payment_logs').insert({
        user_id: user.id,
        plan: redeemCode.plan_type,
        plan_type: redeemCode.plan_type,
        billing_period: redeemCode.billing_period,
        amount_usd: 0,
        currency: 'USD',
        status: 'completed',
        description: `Redeemed code: ${redeemCode.code} — ${redeemCode.plan_type} ${redeemCode.billing_period}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        metadata: { code_id: redeemCode.id, code: redeemCode.code, source: 'redeem_code' },
      });

      await sendEmails(supabase, user.id, redeemCode.plan_type, redeemCode.billing_period, now, expiryDate, 0, 0, redeemCode.code, user.email);

      return new Response(JSON.stringify({
        success: true,
        plan_type: redeemCode.plan_type,
        billing_period: redeemCode.billing_period,
        expires_at: expiryDate,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback to discount_codes (only for 100% off)
    const { data: discountCode } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (!discountCode) {
      return new Response(JSON.stringify({ error: 'Invalid code' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (discountCode.discount_percent < 100) {
      return new Response(JSON.stringify({ error: 'This discount code requires payment at checkout' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validationError = validateCode(discountCode, user.id);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const billingPeriod = discountCode.billing_period || 'monthly';
    const expiryDate = getExpiryDate(billingPeriod).toISOString();
    await activatePlan(supabase, user.id, discountCode.plan_type, billingPeriod, now, expiryDate);

    await supabase
      .from('discount_codes')
      .update({ used_count: (discountCode.used_count || 0) + 1 })
      .eq('id', discountCode.id);

    await supabase.from('subscription_events').insert({
      user_id: user.id,
      event_type: 'redeemed',
      plan_type: discountCode.plan_type,
      billing_period: billingPeriod,
      metadata: { code_id: discountCode.id, code: discountCode.code, discount_percent: discountCode.discount_percent, expires_at: expiryDate },
    }).maybeSingle();

    await supabase.from('payment_logs').insert({
      user_id: user.id,
      plan: discountCode.plan_type,
      plan_type: discountCode.plan_type,
      billing_period: billingPeriod,
      amount_usd: 0,
      currency: 'USD',
      status: 'completed',
      discount_percent: discountCode.discount_percent,
      discount_code: discountCode.code,
      description: `Applied discount code: ${discountCode.code} (${discountCode.discount_percent}% off) — ${discountCode.plan_type} ${billingPeriod}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      metadata: { code_id: discountCode.id, code: discountCode.code, source: 'discount_code' },
    });

    await sendEmails(supabase, user.id, discountCode.plan_type, billingPeriod, now, expiryDate, 0, discountCode.discount_percent, discountCode.code, user.email);

    return new Response(JSON.stringify({
      success: true,
      plan_type: discountCode.plan_type,
      billing_period: billingPeriod,
      expires_at: expiryDate,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});