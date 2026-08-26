CREATE OR REPLACE FUNCTION public.deduct_api_credits(p_user_id uuid, p_api_key_id uuid DEFAULT NULL::uuid, p_operation text DEFAULT 'whoami'::text, p_file_size bigint DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_credits RECORD;
  v_cost RECORD;
  v_plan_limit INTEGER;
  v_credits_to_deduct INTEGER;
  v_multiplier NUMERIC;
  v_key_exists BOOLEAN := false;
BEGIN
  INSERT INTO api_credits (user_id, credits_remaining, daily_limit, last_reset_date)
  VALUES (p_user_id, 1000, 1000, CURRENT_DATE)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_credits FROM api_credits WHERE user_id = p_user_id FOR UPDATE;

  IF p_api_key_id IS NOT NULL THEN
    SELECT custom_daily_limit INTO v_plan_limit
    FROM api_key_limits WHERE api_key_id = p_api_key_id;
    IF v_plan_limit IS NOT NULL AND v_plan_limit > 0 THEN
      v_credits.daily_limit := v_plan_limit;
      v_credits.custom_daily_limit := v_plan_limit;
    END IF;
    SELECT EXISTS(SELECT 1 FROM api_keys WHERE id = p_api_key_id) INTO v_key_exists;
  END IF;

  IF v_credits.last_reset_date < CURRENT_DATE THEN
    v_plan_limit := COALESCE(v_credits.custom_daily_limit, v_credits.daily_limit);
    UPDATE api_credits SET
      credits_remaining = CASE WHEN v_plan_limit = -1 THEN -1 ELSE v_plan_limit END,
      credits_used_today = 0,
      last_reset_date = CURRENT_DATE,
      updated_at = now()
    WHERE user_id = p_user_id;
    v_credits.credits_remaining := CASE WHEN v_plan_limit = -1 THEN -1 ELSE v_plan_limit END;
    v_credits.credits_used_today := 0;
  END IF;

  IF v_credits.credits_remaining = -1 THEN
    RETURN jsonb_build_object('allowed', true, 'credits_deducted', 0, 'credits_remaining', -1, 'credits_used_today', v_credits.credits_used_today, 'daily_limit', -1);
  END IF;

  SELECT * INTO v_cost FROM api_operation_costs WHERE operation = p_operation AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Unknown operation: ' || COALESCE(p_operation, 'null'), 'code', 'UNKNOWN_OPERATION');
  END IF;

  IF v_cost.base_cost = 0 AND (v_cost.per_byte_cost = 0 OR p_file_size = 0) THEN
    RETURN jsonb_build_object('allowed', true, 'credits_deducted', 0, 'credits_remaining', v_credits.credits_remaining, 'credits_used_today', v_credits.credits_used_today, 'daily_limit', v_credits.daily_limit);
  END IF;

  SELECT COALESCE(
    CASE WHEN jsonb_typeof(value) IN ('number','string') THEN (value #>> '{}')::numeric END,
    1.0
  ) INTO v_multiplier
  FROM api_admin_config WHERE key = 'global_daily_credit_multiplier';

  v_credits_to_deduct := GREATEST(1, CEIL((v_cost.base_cost + CEIL(v_cost.per_byte_cost * p_file_size)) * COALESCE(v_multiplier, 1.0))::INTEGER);

  IF v_credits.credits_remaining < v_credits_to_deduct THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Insufficient credits. Required: ' || v_credits_to_deduct || ', Remaining: ' || v_credits.credits_remaining, 'code', 'INSUFFICIENT_CREDITS', 'required', v_credits_to_deduct, 'remaining', v_credits.credits_remaining, 'operation', p_operation);
  END IF;

  UPDATE api_credits SET
    credits_remaining = credits_remaining - v_credits_to_deduct,
    credits_used_today = credits_used_today + v_credits_to_deduct,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO api_credit_log (user_id, api_key_id, operation, credits_deducted, file_size)
  VALUES (
    p_user_id,
    CASE WHEN v_key_exists THEN p_api_key_id ELSE NULL END,
    p_operation,
    v_credits_to_deduct,
    CASE WHEN p_file_size > 0 THEN p_file_size ELSE NULL END
  );

  RETURN jsonb_build_object('allowed', true, 'credits_deducted', v_credits_to_deduct, 'credits_remaining', v_credits.credits_remaining - v_credits_to_deduct, 'credits_used_today', v_credits.credits_used_today + v_credits_to_deduct, 'daily_limit', v_credits.daily_limit);
END;
$function$;
