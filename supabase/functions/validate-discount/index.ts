import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PLAN_AMOUNTS: Record<string, Record<string, number>> = {
  supporter: { weekly: 0.75, monthly: 4, annual: 32 },
  'supporter-plus': { weekly: 1.89, monthly: 10, annual: 80 },
};

function validateCode(code: any, planType?: string, billingPeriod?: string, userId?: string) {
  if (!code.is_active) return { valid: false, error: 'This code is no longer active' };
  if (code.expires_at && new Date(code.expires_at) < new Date()) return { valid: false, error: 'This code has expired' };
  if (code.max_uses && code.used_count >= code.max_uses) return { valid: false, error: 'This code has reached its maximum uses' };
  if (code.for_user_id && code.for_user_id !== userId) return { valid: false, error: 'This code is assigned to a different user' };
  if (planType && code.plan_type !== planType) return { valid: false, error: `This code only works for the ${code.plan_type} plan` };
  if (billingPeriod && code.billing_period && code.billing_period !== billingPeriod) return { valid: false, error: `This code only works for ${code.billing_period} billing` };
  return null;
}

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

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: { code?: string; plan_type?: string; billing_period?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.code) {
      return new Response(JSON.stringify({ error: 'Code is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = body.code.trim().toUpperCase();
    const planType = body.plan_type;
    const billingPeriod = body.billing_period;

    // First try discount_codes (percentage-based)
    const { data: discountCode, error: dcError } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (discountCode && !dcError) {
      const validationError = validateCode(discountCode, planType, billingPeriod, user.id);
      if (validationError) {
        return new Response(JSON.stringify(validationError), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const originalAmount = PLAN_AMOUNTS[discountCode.plan_type]?.[billingPeriod || discountCode.billing_period || 'monthly'] ?? 0;
      const discountedPrice = Math.round((originalAmount * (100 - discountCode.discount_percent) / 100) * 100) / 100;

      return new Response(JSON.stringify({
        valid: true,
        code_type: 'discount',
        code_id: discountCode.id,
        code: discountCode.code,
        plan_type: discountCode.plan_type,
        billing_period: discountCode.billing_period,
        discount_percent: discountCode.discount_percent,
        price: discountedPrice,
        is_free: discountedPrice === 0,
        original_amount: originalAmount,
        discount_amount: originalAmount - discountedPrice,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback to redeem_codes (price-based)
    const { data: redeemCode, error: rcError } = await supabase
      .from('redeem_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (rcError || !redeemCode) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid discount code' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validationError = validateCode(redeemCode, planType, billingPeriod, user.id);
    if (validationError) {
      return new Response(JSON.stringify(validationError), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const originalAmount = PLAN_AMOUNTS[redeemCode.plan_type]?.[redeemCode.billing_period] ?? 0;
    const discountAmount = Math.max(0, originalAmount - redeemCode.price);
    const discountPercent = originalAmount > 0 ? Math.round((1 - redeemCode.price / originalAmount) * 100) : 100;

    return new Response(JSON.stringify({
      valid: true,
      code_type: 'redeem',
      code_id: redeemCode.id,
      code: redeemCode.code,
      plan_type: redeemCode.plan_type,
      billing_period: redeemCode.billing_period,
      price: redeemCode.price,
      is_free: redeemCode.price === 0,
      original_amount: originalAmount,
      discount_amount: discountAmount,
      discount_percent: discountPercent,
      currency: redeemCode.currency || 'USD',
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
