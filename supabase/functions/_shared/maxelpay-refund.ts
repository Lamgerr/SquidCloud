// MaxelPay refund helper for support-ops edge function.
// Semi-automatic: reviewer initiates, system calls API, tracks status.

const MAXELPAY_API = "https://api.maxelpay.com/api/v1";

export interface RefundResult {
  success: boolean;
  refund_id?: string;
  status?: string;
  message?: string;
  raw?: any;
}

export async function initiateMaxelPayRefund(
  supabase: any,
  opts: {
    amount: number;
    currency: string;
    destinationAddress: string;
    originalTxnId: string;
    userId: string;
    planType: string;
    mode?: "live" | "test";
  }
): Promise<RefundResult> {
  const mode = opts.mode || "live";
  const keyName = mode === "test" ? "MAXELPAY_TEST_API_KEY" : "MAXELPAY_LIVE_API_KEY";

  const { data: config } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", keyName)
    .single();

  const apiKey = config?.value;
  if (!apiKey) {
    return { success: false, message: `${keyName} not configured` };
  }

  try {
    // MaxelPay refund endpoint: POST /refunds
    const res = await fetch(`${MAXELPAY_API}/refunds`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: opts.amount,
        currency: opts.currency,
        destination_address: opts.destinationAddress,
        original_transaction_id: opts.originalTxnId,
        user_id: opts.userId,
        plan_type: opts.planType,
        reason: "user_requested",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        message: data.message || `MaxelPay refund error: ${res.status}`,
        raw: data,
      };
    }

    return {
      success: true,
      refund_id: data.data?.refund_id || data.refund_id || data.id,
      status: data.data?.status || data.status || "processing",
      raw: data,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function checkMaxelPayRefundStatus(
  supabase: any,
  refundId: string,
  mode: "live" | "test" = "live"
): Promise<{ status: string; raw?: any }> {
  const keyName = mode === "test" ? "MAXELPAY_TEST_API_KEY" : "MAXELPAY_LIVE_API_KEY";

  const { data: config } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", keyName)
    .single();

  const apiKey = config?.value;
  if (!apiKey) return { status: "unknown" };

  try {
    const res = await fetch(`${MAXELPAY_API}/refunds/${refundId}`, {
      method: "GET",
      headers: { "X-API-KEY": apiKey },
    });

    const data = await res.json();
    if (!res.ok) return { status: "unknown", raw: data };

    return {
      status: data.data?.status || data.status || "unknown",
      raw: data,
    };
  } catch {
    return { status: "unknown" };
  }
}
