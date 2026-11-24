CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_user_id uuid,
  p_reason text DEFAULT NULL,
  p_cancelled_by text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_is_admin boolean;
  v_plan_type text;
  v_billing_period text;
  v_result jsonb;
BEGIN
  -- Get caller identity
  v_caller_id := auth.uid();

  -- Authorization: caller must be the user themselves OR an admin
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_caller_id = p_user_id THEN
    -- User cancelling themselves — always allowed
    NULL;
  ELSE
    -- Check if caller is admin
    SELECT is_admin INTO v_is_admin
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_is_admin IS NOT TRUE THEN
      RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
    END IF;
  END IF;

  -- Get current plan info for event logging
  SELECT tier INTO v_plan_type
  FROM public.profiles
  WHERE id = p_user_id;

  -- Get latest billing_period from events
  SELECT billing_period INTO v_billing_period
  FROM public.subscription_events
  WHERE user_id = p_user_id AND billing_period IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Update profile
  UPDATE public.profiles
  SET
    is_premium = false,
    tier = 'free',
    subscription_starts_at = NULL,
    subscription_expires_at = NULL,
    updated_at = now()
  WHERE id = p_user_id;

  -- Log the event
  INSERT INTO public.subscription_events (
    user_id,
    event_type,
    plan_type,
    billing_period,
    metadata
  ) VALUES (
    p_user_id,
    'cancelled',
    COALESCE(v_plan_type, 'free'),
    v_billing_period,
    jsonb_build_object(
      'reason', p_reason,
      'cancelled_by', p_cancelled_by,
      'cancelled_at', now()::text
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.cancel_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription TO anon;
