-- ============================================================
-- Phase 12: minimum-participants quorum feature (schema).
--
-- Purely additive. Defaults leave every existing activity with
-- `min_participants = 0` (feature disabled) and every existing
-- session in `quorum_state = 'pending'`, which together are a
-- no-op for unchanged instructors.
--
-- Rollback: DROP COLUMNs and the added enum values; see bottom.
-- ============================================================

BEGIN;

-- --------------------------------------------------------------
-- activities: the opt-in threshold lives here, not on sessions.
-- --------------------------------------------------------------
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS min_participants INTEGER NOT NULL DEFAULT 0
    CHECK (min_participants >= 0);

-- Min must never exceed max; nonsensical otherwise. The form
-- validates too but we want a hard guarantee.
ALTER TABLE public.activities
  ADD CONSTRAINT min_participants_lte_max_seats
    CHECK (min_participants <= max_seats);

-- --------------------------------------------------------------
-- activity_sessions: quorum state machine.
--
-- Orthogonal to `status`. When quorum auto-cancel fires we flip
-- BOTH quorum_state = 'cancelled' AND status = 'cancelled' so
-- existing queries that filter by `status` keep working.
-- --------------------------------------------------------------
ALTER TABLE public.activity_sessions
  ADD COLUMN IF NOT EXISTS quorum_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (quorum_state IN ('pending', 'confirmed', 'at_risk', 'cancelled'));

ALTER TABLE public.activity_sessions
  ADD COLUMN IF NOT EXISTS quorum_evaluated_at TIMESTAMPTZ;

ALTER TABLE public.activity_sessions
  ADD COLUMN IF NOT EXISTS instructor_confirmed_at TIMESTAMPTZ;

-- Partial index on the at-risk subset: the cron polls this every
-- hour looking for sessions to expire. Most sessions are never
-- at_risk, so a partial index is much smaller than full.
CREATE INDEX IF NOT EXISTS idx_activity_sessions_at_risk
  ON public.activity_sessions (quorum_evaluated_at)
  WHERE quorum_state = 'at_risk';

-- --------------------------------------------------------------
-- notification_type: three new values.
--   session_quorum_at_risk — sent to instructor at T-24h
--   session_confirmed      — sent to all participants when quorum
--                            is reached (by booking OR by override)
--
-- booking_cancelled already exists and is reused for quorum auto-
-- cancel; the body text varies by reason.
-- --------------------------------------------------------------
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'session_quorum_at_risk';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'session_confirmed';

COMMIT;

-- Rollback (manual, for reference):
--   ALTER TABLE activities DROP CONSTRAINT min_participants_lte_max_seats;
--   ALTER TABLE activities DROP COLUMN min_participants;
--   DROP INDEX idx_activity_sessions_at_risk;
--   ALTER TABLE activity_sessions
--     DROP COLUMN instructor_confirmed_at,
--     DROP COLUMN quorum_evaluated_at,
--     DROP COLUMN quorum_state;
--   -- enum values cannot be dropped in Postgres; leave in place.
