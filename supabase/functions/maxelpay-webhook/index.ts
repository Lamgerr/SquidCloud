import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSignal } from "../_shared/signals.ts";
import {
  sendEmail,
  buildReceiptEmailHtml,
  buildWelcomeEmailHtml,
  getDisplayName,
  type ReceiptParams,
} from "../_shared/gmail-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

let _mxlpyApiKey: string | null = null;

async function getMxlpyApiKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  if (_mxlpyApiKey !== null) return _mxlpyApiKey;
  const { data } = await supabase.from('system_config').select('value').eq('key', 'MXLPY_API_KEY').single();
  _mxlpyApiKey = data?.value || null;
  return _mxlpyApiKey;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function getExpiryDateByBilling(billingPeriod: string): Date {
  const now = new Date();
  if (billingPeriod === 'weekly') return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (billingPeriod === 'annual') return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
}

const KNOWN_BILLING = ['weekly', 'monthly', 'annual'];

async function sendPaymentEmails(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planType: string,
  billingPeriod: string,
  startsAt: string,
  expiresAt: string,
  amount: number,
  txHash: string,
) {
  const [profile, authUser] = await Promise.all([
    supabase.from('profiles').select('username, display_name, full_name, email').eq('id', userId).maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);
  const username = getDisplayName(profile.data);
  const recipientEmail = profile.data?.email || authUser.data?.user?.email || '';

  if (!recipientEmail) {
    console.warn('No email found for user, skipping payment emails');
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
    const receiptText = `Your ${planName} ${billingPeriod} subscription is active. Total: $${amount.toFixed(2)} USD. TX: ${txHash}`;
    const receiptParams: ReceiptParams = {
      username,
      userId,
      planType,
      billingPeriod,
      startsAt,
      expiresAt,
      amount,
      currency: 'USD',
      paymentMode: 'crypto',
      discountPercent: 0,
      discountCode: '',
      txHash,
    };
    await sendEmail(recipientEmail, receiptSubject, receiptText, buildReceiptEmailHtml(receiptParams));
  } catch (e) {
    console.error('Failed to send receipt email:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const mxlpyApiKey = await getMxlpyApiKey(supabase);
  const requestApiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (mxlpyApiKey && requestApiKey !== mxlpyApiKey) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await req.json();
    const { event, data: eventData } = body;

    if (!event || !eventData) {
      return json({ error: 'Invalid payload' }, 400);
    }

    const { orderId, status: paymentStatus, sessionId, txHash, network, token, amount, paidAt, currency } = eventData;

    if (!orderId) {
      return json({ error: 'Missing orderId' }, 400);
    }

    const parts = orderId.split('_');
    if (parts.length < 3) {
      return json({ error: 'Invalid orderId format' }, 400);
    }

    const isNewFormat = KNOWN_BILLING.includes(parts[1]);

    const planId = parts[0];
    let billingPeriod: string;
    let userId: string;

    if (isNewFormat) {
      billingPeriod = parts[1];
      userId = parts.slice(2, -1).join('_');
    } else {
      billingPeriod = 'monthly';
      userId = parts.slice(1, -1).join('_');
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const planType = planId === 'supporter-plus' ? 'supporter-plus' : 'supporter';

    if (event === 'payment.pending') {
      await supabase.from('payment_logs').insert({
        user_id: userId,
        plan: planId,
        plan_type: planType,
        billing_period: billingPeriod,
        amount_usd: amount,
        currency: currency || 'USD',
        tx_hash: txHash,
        network,
        token,
        session_id: sessionId,
        status: 'pending',
        description: `Payment initiated — ${planType} ${billingPeriod}`,
        timezone,
      });
      console.log(`Payment pending logged for user ${userId}, session ${sessionId}`);
    }

    if (event === 'payment.completed' && paymentStatus === 'paid') {
      const now = new Date().toISOString();
      const expiryDate = getExpiryDateByBilling(billingPeriod).toISOString();

      await supabase.from('profiles').update({
        is_premium: true,
        tier: planType,
        subscription_starts_at: now,
        subscription_expires_at: expiryDate,
        updated_at: now,
      }).eq('id', userId);

      await supabase.from('payment_logs').insert({
        user_id: userId,
        plan: planId,
        plan_type: planType,
        billing_period: billingPeriod,
        amount_usd: amount,
        currency: currency || 'USD',
        tx_hash: txHash,
        network,
        token,
        session_id: sessionId,
        paid_at: paidAt,
        status: 'completed',
        description: `Payment completed — ${planType} ${billingPeriod}`,
        timezone,
      });

      await supabase.from('subscription_events').insert({
        user_id: userId,
        event_type: 'purchased',
        plan_type: planType,
        billing_period: billingPeriod,
        metadata: {
          plan_id: planId,
          amount,
          tx_hash: txHash,
          session_id: sessionId,
          expires_at: expiryDate,
        },
      }).maybeSingle();

      await sendPaymentEmails(supabase, userId, planType, billingPeriod, now, expiryDate, amount || 0, txHash || '');

      void sendSignal({
        service_id: 'cloudbliss',
        user_id: userId,
        type: 'payment_success',
        severity: 'info',
        title: 'Payment successful',
        body: `Your ${planType} ${billingPeriod} plan is now active.`,
        link: '/dashboard',
        idempotency_key: `payment_success:${sessionId}`,
      });
    }

    if (event === 'payment.failed') {
      await supabase.from('payment_logs').insert({
        user_id: userId,
        plan: planId,
        plan_type: planType,
        billing_period: billingPeriod,
        amount_usd: amount,
        currency: currency || 'USD',
        session_id: sessionId,
        status: 'failed',
        description: `Payment failed — ${planType} ${billingPeriod}`,
        timezone,
      });

      await supabase.from('subscription_events').insert({
        user_id: userId,
        event_type: 'payment_failed',
        plan_type: planType,
        metadata: {
          amount,
          session_id: sessionId,
        },
      }).maybeSingle();

      void sendSignal({
        service_id: 'cloudbliss',
        user_id: userId,
        type: 'subscription_payment_failed',
        severity: 'urgent',
        title: 'Payment failed',
        body: `Your ${planType} ${billingPeriod} payment could not be processed. Check your payment details and try again.`,
        link: '/checkout',
        idempotency_key: `payment_failed:${sessionId}`,
      });
    }

    if (event === 'payment.expired') {
      await supabase.from('payment_logs').insert({
        user_id: userId,
        plan: planId,
        plan_type: planType,
        billing_period: billingPeriod,
        session_id: sessionId,
        status: 'expired',
        description: `Payment session expired — ${planType} ${billingPeriod}`,
        timezone,
      });

      await supabase.from('subscription_events').insert({
        user_id: userId,
        event_type: 'payment_expired',
        plan_type: planType,
        metadata: {
          session_id: sessionId,
        },
      }).maybeSingle();
    }

    return json({ received: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});