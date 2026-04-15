-- ============================================================
-- Phase 12: admin audit log
--
-- Every destructive or permission-changing admin action writes
-- a row here so we have a forensic trail. Written from server
-- actions (approveInstructorAction, demoteInstructorAction,
-- adminCancelActivityAction) via the service-role admin client
-- — the table is intentionally not writable by authenticated
-- users through RLS, so regular sessions can't forge entries.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_created
  ON public.admin_actions(admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_actions_target
  ON public.admin_actions(target_type, target_id);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Admins can read the audit log. Nobody else — not even the
-- target of an action. Writes happen via the service-role client
-- in application code, which bypasses RLS anyway.
DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_actions;
CREATE POLICY "Admins can read audit log"
  ON public.admin_actions FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');
