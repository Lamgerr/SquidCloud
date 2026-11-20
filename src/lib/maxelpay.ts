import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseEnv';
import { secureSupabase } from '@/lib/supabase-proxy';

const MAXELPAY_API = 'https://api.maxelpay.com/api/v1';

async function callProxy(endpoint: string, payload: any, testMode = false): Promise<any> {
  const { data: sessionData } = await secureSupabase.auth.getSession();
  const token = sessionData.session?.access_token ?? SUPABASE_ANON_KEY;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/maxelpay-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ endpoint, payload, mode: testMode ? 'test' : 'live' }),
  });

  // Never let an HTML/error page surface as a raw JSON.parse error to users.
  const raw = await res.text();
  let data: any;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('The payment provider is temporarily unavailable. Please try again shortly.');
  }
  if (!res.ok) throw new Error(data.error || data.message || `Payment error (${res.status})`);
  return data;
}

export interface MaxelPaySession {
  sessionId: string;
  hostedCheckoutUrl: string;
  status: string;
  data?: {
    paymentUrl: string;
    sessionId: string;
    status: string;
  };
}

export interface MaxelPayWebhookPayload {
  event: 'payment.completed' | 'payment.partial' | 'payment.overpaid' | 'payment.expired';
  timestamp: string;
  data: {
    sessionId: string;
    orderId: string;
    status: string;
    amount: number;
    currency: string;
    paidAmount: number;
    totalPaidUsd: number;
    txHash: string;
    network: string;
    tokenSymbol: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
  };
}

export async function createPaymentSession(params: {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  callbackUrl: string;
}, testMode = false): Promise<MaxelPaySession> {
  return callProxy('/payments/sessions', params, testMode);
}

export async function getSessionStatus(sessionId: string, testMode = false): Promise<MaxelPaySession> {
  return callProxy(`/payments/sessions/${sessionId}/status`, null, testMode);
}
