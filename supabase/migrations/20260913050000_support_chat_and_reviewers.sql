-- ============================================================
-- SUPPORT CHAT + REVIEWER DASHBOARD
-- New tables: reviewers, support_refunds, support_activity_log
-- Column addition: support_tickets.assigned_reviewer_id
-- ============================================================

-- 1. Reviewer profiles (separate from profiles.is_admin)
-- Uses Supabase Auth email+password; this table stores reviewer-specific data.
CREATE TABLE IF NOT EXISTS public.reviewers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviewers ENABLE ROW LEVEL SECURITY;

-- Reviewers can read their own row; service_role manages all
CREATE POLICY "Reviewers can view own profile" ON public.reviewers
  FOR SELECT USING (auth.uid() = id);

-- Service role handles inserts/updates (admin-managed)

-- 2. Support refunds (semi-automatic refund tracking)
CREATE TABLE IF NOT EXISTS public.support_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  destination_address text NOT NULL,
  payment_txn_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'rejected', 'failed')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  maxelpay_refund_id text,
  notes text NOT NULL DEFAULT '',
  receipt_html text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_refunds_ticket ON public.support_refunds(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_refunds_user ON public.support_refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_support_refunds_status ON public.support_refunds(status);

ALTER TABLE public.support_refunds ENABLE ROW LEVEL SECURITY;

-- Users can see their own refunds
CREATE POLICY "Users can view own refunds" ON public.support_refunds
  FOR SELECT USING (auth.uid() = user_id);

-- Service role manages all refund operations

-- 3. Support activity log (audit trail for reviewer visibility)
CREATE TABLE IF NOT EXISTS public.support_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_activity_ticket ON public.support_activity_log(ticket_id, created_at DESC);

ALTER TABLE public.support_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can see activity on their own tickets
CREATE POLICY "Users can view own ticket activity" ON public.support_activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = support_activity_log.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

-- 4. Add assigned_reviewer_id to support_tickets
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS assigned_reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. Trigger to update support_refunds.updated_at
CREATE OR REPLACE FUNCTION update_support_refunds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_support_refunds_updated_at ON public.support_refunds;
CREATE TRIGGER update_support_refunds_updated_at
  BEFORE UPDATE ON public.support_refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_support_refunds_updated_at();

-- 6. RLS for reviewer access to existing support tables
-- Reviewers manage all tickets and messages via service_role in the edge function.
-- We add a policy so that authenticated reviewers (via service_role) can read/write everything.
-- Since the edge function uses service_role, this is primarily for the reviewer dashboard
-- which uses its own Supabase project with a different auth setup.

-- Admin/reviewer override policies on support_tickets
DROP POLICY IF EXISTS "Reviewers can manage all support tickets" ON public.support_tickets;
CREATE POLICY "Reviewers can manage all support tickets"
  ON public.support_tickets FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.reviewers WHERE reviewers.id = auth.uid() AND reviewers.is_active = true)
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.reviewers WHERE reviewers.id = auth.uid() AND reviewers.is_active = true)
    OR public.is_admin()
  );

-- Admin/reviewer override policies on support_messages
DROP POLICY IF EXISTS "Reviewers can manage all support messages" ON public.support_messages;
CREATE POLICY "Reviewers can manage all support messages"
  ON public.support_messages FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.reviewers WHERE reviewers.id = auth.uid() AND reviewers.is_active = true)
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.reviewers WHERE reviewers.id = auth.uid() AND reviewers.is_active = true)
    OR public.is_admin()
  );

-- Reviewers can see all refunds
DROP POLICY IF EXISTS "Reviewers can manage all refunds" ON public.support_refunds;
CREATE POLICY "Reviewers can manage all refunds"
  ON public.support_refunds FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.reviewers WHERE reviewers.id = auth.uid() AND reviewers.is_active = true)
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.reviewers WHERE reviewers.id = auth.uid() AND reviewers.is_active = true)
    OR public.is_admin()
  );

-- Reviewers can see all activity logs
DROP POLICY IF EXISTS "Reviewers can manage all activity logs" ON public.support_activity_log;
CREATE POLICY "Reviewers can manage all activity logs"
  ON public.support_activity_log FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.reviewers WHERE reviewers.id = auth.uid() AND reviewers.is_active = true)
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.reviewers WHERE reviewers.id = auth.uid() AND reviewers.is_active = true)
    OR public.is_admin()
  );

-- 7. Enable realtime for support_messages (for live conversation updates)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.support_messages;
