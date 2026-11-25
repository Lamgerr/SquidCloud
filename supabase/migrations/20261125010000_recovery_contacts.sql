-- Social recovery contacts (v12 §17.8). Owner-only; server holds only
-- encrypted share envelopes and commitments, never usable shares.
CREATE TABLE IF NOT EXISTS public.recovery_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id text NOT NULL,
  share_envelope text NOT NULL,
  commitment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_id)
);
ALTER TABLE public.recovery_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_contacts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recovery_contacts_owner ON public.recovery_contacts;
CREATE POLICY recovery_contacts_owner ON public.recovery_contacts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.recovery_contacts FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_contacts TO authenticated;
