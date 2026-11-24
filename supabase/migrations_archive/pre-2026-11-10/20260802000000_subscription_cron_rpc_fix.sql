-- Subscription expiry notification pipeline: RPC fixes + hourly cron
-- 1. Fix get_subscriptions_needing_notifications: u.email::text (varchar vs text) and
--    remove duplicated subscription_starts_at reference that made the column ambiguous.
-- 2. Ensure ensure_notification_triggered is defined (idempotent per user/stage/type).
-- 3. Schedule hourly cron job hitting subscription-manager/cron with X-Internal-Key.

CREATE OR REPLACE FUNCTION public.get_subscriptions_needing_notifications()
 RETURNS TABLE(user_id uuid, email text, full_name text, plan_type text, billing_period text, subscription_starts_at timestamp with time zone, subscription_expires_at timestamp with time zone, days_remaining integer, days_since_expiry integer, current_stage integer, max_stage integer, total_days integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH active_subs AS (
    SELECT
      p.id AS user_id,
      u.email::text AS email,
      p.full_name,
      p.tier AS plan_type,
      'monthly'::text AS billing_period,
      p.subscription_starts_at,
      p.subscription_expires_at,
      CASE
        WHEN p.subscription_expires_at IS NOT NULL AND p.subscription_expires_at > now()
          THEN EXTRACT(DAY FROM p.subscription_expires_at - now())::integer
        ELSE 0
      END AS days_remaining,
      CASE
        WHEN p.subscription_expires_at IS NOT NULL AND p.subscription_expires_at <= now()
          THEN EXTRACT(DAY FROM now() - p.subscription_expires_at)::integer
        ELSE 0
      END AS days_since_expiry
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.is_premium = true
      AND p.subscription_expires_at IS NOT NULL
  )
  SELECT
    s.user_id,
    s.email,
    s.full_name,
    s.plan_type,
    s.billing_period,
    s.subscription_starts_at,
    s.subscription_expires_at,
    s.days_remaining,
    s.days_since_expiry,
    CASE s.billing_period
      WHEN 'weekly' THEN
        CASE
          WHEN s.days_remaining > 2 THEN 0
          WHEN s.days_remaining = 2 THEN 1
          WHEN s.days_remaining = 1 THEN 2
          WHEN s.days_remaining = 0 AND s.subscription_expires_at > now() THEN 3
          WHEN s.days_since_expiry = 0 THEN 4
          WHEN s.days_since_expiry = 1 THEN 5
          WHEN s.days_since_expiry <= 3 THEN 6
          ELSE 99
        END
      WHEN 'monthly' THEN
        CASE
          WHEN s.days_remaining > 9 THEN 0
          WHEN s.days_remaining > 5 THEN 1
          WHEN s.days_remaining > 2 THEN 2
          WHEN s.days_remaining > 1 THEN 3
          WHEN s.days_remaining = 1 THEN 4
          WHEN s.days_remaining = 0 AND s.subscription_expires_at > now() THEN 4
          WHEN s.days_since_expiry = 0 THEN 5
          WHEN s.days_since_expiry <= 1 THEN 6
          WHEN s.days_since_expiry <= 5 THEN 7
          WHEN s.days_since_expiry <= 10 THEN 8
          ELSE 99
        END
      WHEN 'annual' THEN
        CASE
          WHEN s.days_remaining > 30 THEN 0
          WHEN s.days_remaining > 15 THEN 1
          WHEN s.days_remaining > 7 THEN 2
          WHEN s.days_remaining > 3 THEN 3
          WHEN s.days_remaining > 1 THEN 4
          WHEN s.days_remaining = 1 THEN 5
          WHEN s.days_remaining = 0 AND s.subscription_expires_at > now() THEN 5
          WHEN s.days_since_expiry = 0 THEN 6
          WHEN s.days_since_expiry <= 1 THEN 7
          WHEN s.days_since_expiry <= 7 THEN 8
          WHEN s.days_since_expiry <= 14 THEN 9
          WHEN s.days_since_expiry <= 30 THEN 10
          ELSE 99
        END
    END AS current_stage,
    CASE s.billing_period
      WHEN 'weekly' THEN 6
      WHEN 'monthly' THEN 8
      WHEN 'annual' THEN 10
    END AS max_stage,
    CASE s.billing_period
      WHEN 'weekly' THEN 7
      WHEN 'monthly' THEN 30
      WHEN 'annual' THEN 365
    END AS total_days
  FROM active_subs s
  WHERE s.subscription_expires_at <= now() + interval '90 days'
    OR s.days_since_expiry <= 30;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_notification_triggered(p_user_id uuid, p_stage integer, p_notification_type text, p_plan_type text, p_billing_period text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  already_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.subscription_notifications
    WHERE user_id = p_user_id
      AND stage = p_stage
      AND notification_type = p_notification_type
  ) INTO already_exists;

  IF already_exists THEN
    RETURN false;
  END IF;

  INSERT INTO public.subscription_notifications (
    user_id, plan_type, billing_period, stage, notification_type, delivered
  ) VALUES (
    p_user_id, p_plan_type, p_billing_period, p_stage, p_notification_type, true
  );

  RETURN true;
END;
$function$;

-- Hourly subscription expiry check (idempotent: unschedule before schedule)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'subscription-expiry-check';

SELECT cron.schedule(
  'subscription-expiry-check',
  '0 * * * *',
  $$SELECT net.http_post(
    url := 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/subscription-manager/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Key', (SELECT value FROM public.system_config WHERE key = 'INTERNAL_WEBHOOK_KEY')
    ),
    body := jsonb_build_object()
  )$$
);
