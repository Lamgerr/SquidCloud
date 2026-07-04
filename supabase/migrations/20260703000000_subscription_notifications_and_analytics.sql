-- Subscription Notifications, User Preferences, and Analytics Support
-- Migration: 20260703000000

CREATE TABLE IF NOT EXISTS public.subscription_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage integer NOT NULL DEFAULT 1,
  notification_type text NOT NULL DEFAULT 'email',
  delivered boolean NOT NULL DEFAULT false,
  clicked boolean NOT NULL DEFAULT false,
  dismissed boolean NOT NULL DEFAULT false,
  upsell_offer_shown boolean NOT NULL DEFAULT false,
  upsell_offer_accepted boolean NOT NULL DEFAULT false,
  snoozed_until timestamptz,
  plan_type text,
  billing_period text,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_notifications_user_id ON public.subscription_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_notifications_triggered_at ON public.subscription_notifications(triggered_at);
CREATE INDEX IF NOT EXISTS idx_sub_notifications_stage ON public.subscription_notifications(stage);

ALTER TABLE public.subscription_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.subscription_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage notifications"
  ON public.subscription_notifications FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{"email_notifications": true, "reminder_days": [7, 3, 1], "winback_enabled": true, "upsell_offers": true}'::jsonb;

CREATE TABLE IF NOT EXISTS public.user_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_notifications boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT true,
  reminder_days integer[] NOT NULL DEFAULT '{7,3,1}',
  winback_enabled boolean NOT NULL DEFAULT true,
  upsell_offers boolean NOT NULL DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification prefs"
  ON public.user_notification_prefs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification prefs"
  ON public.user_notification_prefs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage notification prefs"
  ON public.user_notification_prefs FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

ALTER TABLE public.subscription_events
  DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;

ALTER TABLE public.subscription_events
  ADD CONSTRAINT subscription_events_event_type_check
  CHECK (event_type IN ('purchased', 'redeemed', 'expired', 'cancelled', 'payment_failed', 'payment_expired', 'renewed', 'downgraded', 'email_sent', 'winback_sent', 'upsell_accepted', 'upsell_declined', 'notification_sent', 'notification_clicked', 'notification_dismissed', 'admin_granted'));
