import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseEnv';

const MAXELPAY_API = 'https://api.maxelpay.com/api/v1';

async function callProxy(endpoint: string, payload: any, testMode = false): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/maxelpay-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ endpoint, payload, mode: testMode ? 'test' : 'live' }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Proxy error: ${res.status}`);
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
