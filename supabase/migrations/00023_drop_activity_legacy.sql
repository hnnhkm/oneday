-- ============================================================
-- Phase 6B of the activity-sessions split: drop the legacy
-- per-activity date/time/seat columns and the transition-mode
-- glue (mirror triggers + book_activity RPCs) installed in
-- migrations 00003, 00015, 00020, 00022.
--
-- Preconditions (enforced by the Phase 6A PR that must ship
-- first):
--   * Every application-layer read of activities.date,
--     activities.time, activities.max_seats,
--     activities.seats_remaining has been migrated to derive
--     those values from `activity_sessions` (via the new
--     `session-synthesis` helper or direct session embeds).
--   * `createCheckoutSessionAction`, the Stripe webhook, and
--     `cancelBookingAction` all book against `activity_sessions`
--     via the session-scoped RPCs from migration 00022, not
--     the legacy `book_activity`/`book_activity_from_webhook`.
--   * Instructor-side CRUD (create/update/duplicate/publish)
--     has stopped writing to the four legacy columns and now
--     writes session rows directly (create + duplicate), or
--     leaves seat/time edits entirely to the SessionsManager
--     panel (edit flow).
--
-- What this migration does, in order:
--   1. Drop the mirror triggers + functions. After this point
--      activities.date|time|max_seats|seats_remaining will
--      drift stale, which is fine since (by precondition) no
--      reader looks at them.
--   2. Drop the legacy booking RPCs, now unused.
--   3. Rewrite cancel_activity_with_refunds() so its "is the
--      activity still in the future?" check reads from
--      `activity_sessions` instead of the dropped
--      `activities.date`.
--   4. Drop the four columns themselves.
--
-- Rollback: see bottom of file. Note that rolling back after
-- real instructors have added multi-session activities will
-- LOSE those extra sessions' date/time info (the legacy columns
-- can only represent one session per activity). Test rollbacks
-- against a snapshot before running them in anger.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Mirror triggers + functions from 00020
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS mirror_sessions_to_activities ON public.activity_sessions;
DROP TRIGGER IF EXISTS mirror_activities_to_sessions ON public.activities;
DROP FUNCTION IF EXISTS public.mirror_session_to_activity();
DROP FUNCTION IF EXISTS public.mirror_activity_to_session();

-- ------------------------------------------------------------
-- 2. Legacy booking RPCs from 00003 + 00015
--
-- Their session-scoped successors (book_session,
-- book_session_from_webhook) were introduced in 00022 and the
-- application has been calling those exclusively since Phase 3.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.book_activity_from_webhook(uuid, uuid, integer, text);
DROP FUNCTION IF EXISTS public.book_activity(uuid, uuid, integer);

-- ------------------------------------------------------------
-- 3. cancel_activity_with_refunds: read "is the activity still
--    cancellable?" from sessions rather than activities.date.
--
-- Logic change: an activity is "already past" (and therefore
-- uncancellable) iff it has no session whose starts_at is still
-- in the future. A draft activity that never had a session is
-- also uncancellable by the old guard (status must be
-- 'published'), so the precondition change is only observable
-- for published activities whose last session is in the past —
-- which is the correct behavior.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_activity_with_refunds(
  p_activity_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_status activity_status;
  v_title TEXT;
  v_has_future_session BOOLEAN;
  v_affected INT := 0;
  v_booking RECORD;
BEGIN
  -- Caller must be an approved instructor who owns the activity.
  SELECT ip.id INTO v_profile_id
  FROM public.instructor_profiles ip
  WHERE ip.user_id = auth.uid()
    AND ip.approval_status = 'approved';

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT a.status, COALESCE(a.title->>'pt', 'atividade')
    INTO v_status, v_title
  FROM public.activities a
  WHERE a.id = p_activity_id
    AND a.instructor_id = v_profile_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'activity_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'activity_not_cancellable: status=%', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Phase 6B: "still in the future" = has ≥1 session whose
  -- starts_at > now(). We only consider published sessions
  -- here — a cancelled/completed session doesn't keep the
  -- activity cancellable.
  SELECT EXISTS (
    SELECT 1
    FROM public.activity_sessions s
    WHERE s.activity_id = p_activity_id
      AND s.status = 'published'
      AND s.starts_at > now()
  ) INTO v_has_future_session;

  IF NOT v_has_future_session THEN
    RAISE EXCEPTION 'activity_already_past' USING ERRCODE = 'P0001';
  END IF;

  -- Flip each active booking and notify the booker.
  FOR v_booking IN
    SELECT id, user_id
    FROM public.bookings
    WHERE activity_id = p_activity_id
      AND status <> 'cancelled'
  LOOP
    UPDATE public.bookings
    SET status = 'cancelled',
        payment_status = 'refunded',
        cancelled_at = now()
    WHERE id = v_booking.id;

    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      v_booking.user_id,
      'booking_cancelled',
      'Atividade cancelada',
      CASE
        WHEN p_reason IS NULL OR length(trim(p_reason)) = 0
          THEN format('A atividade "%s" foi cancelada pelo instrutor. Seu pagamento será reembolsado.', v_title)
        ELSE format('A atividade "%s" foi cancelada pelo instrutor. Motivo: %s. Seu pagamento será reembolsado.', v_title, trim(p_reason))
      END,
      'in_app'
    );

    v_affected := v_affected + 1;
  END LOOP;

  -- Flip the activity itself AND every remaining non-cancelled
  -- session so future reads don't surface a "published" session
  -- whose parent is cancelled. The SessionsManager is the primary
  -- way instructors cancel individual sessions, but an activity-
  -- level cancel must cascade.
  UPDATE public.activities
  SET status = 'cancelled'
  WHERE id = p_activity_id;

  UPDATE public.activity_sessions
  SET status = 'cancelled'
  WHERE activity_id = p_activity_id
    AND status <> 'cancelled';

  RETURN v_affected;
END;
$$;

-- ------------------------------------------------------------
-- 4. Drop the legacy columns.
--
-- The columns are currently NOT NULL with CHECK constraints.
-- DROP COLUMN removes those constraints implicitly. The
-- `seats_remaining_lte_max` cross-column CHECK on activities
-- also goes away with the columns it references.
--
-- search_vector (generated column from 00017) does NOT
-- reference any of these columns, so it's unaffected.
-- ------------------------------------------------------------
ALTER TABLE public.activities
  DROP COLUMN IF EXISTS seats_remaining,
  DROP COLUMN IF EXISTS max_seats,
  DROP COLUMN IF EXISTS time,
  DROP COLUMN IF EXISTS date;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, destructive — see top-of-file caveat):
--
--   BEGIN;
--
--   ALTER TABLE public.activities
--     ADD COLUMN date DATE,
--     ADD COLUMN time TIME,
--     ADD COLUMN max_seats INTEGER,
--     ADD COLUMN seats_remaining INTEGER;
--
--   -- Best-effort backfill: pick the earliest published session
--   -- per activity and copy its fields. For activities that have
--   -- multiple sessions, only one is representable; the rest are
--   -- silently lost by this shape.
--   UPDATE public.activities a
--   SET date            = s.local_date,
--       time            = s.local_time,
--       max_seats       = s.max_seats,
--       seats_remaining = s.seats_remaining
--   FROM (
--     SELECT DISTINCT ON (activity_id)
--       activity_id, local_date, local_time, max_seats, seats_remaining
--     FROM public.activity_sessions
--     ORDER BY activity_id, starts_at ASC
--   ) s
--   WHERE a.id = s.activity_id;
--
--   ALTER TABLE public.activities
--     ALTER COLUMN date SET NOT NULL,
--     ALTER COLUMN time SET NOT NULL,
--     ALTER COLUMN max_seats SET NOT NULL,
--     ALTER COLUMN seats_remaining SET NOT NULL,
--     ADD CONSTRAINT seats_remaining_lte_max
--       CHECK (seats_remaining <= max_seats);
--
--   -- Restore the original cancel_activity_with_refunds body
--   -- from 00005 (see that file for the canonical source).
--
--   -- Restore mirror triggers and legacy RPCs from the original
--   -- migration files (00003, 00015, 00020). Do NOT copy them
--   -- from stale backups — confirm the source.
--
--   COMMIT;
-- ============================================================
