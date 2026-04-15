-- ============================================================
-- Phase 1 of the activity-sessions split.
--
-- Today an "activity" carries a single date + time + max_seats
-- + seats_remaining. Instructors who want to offer the same
-- experience on multiple dates have to duplicate the row.
--
-- This migration introduces a new `activity_sessions` table so
-- one activity (the template) can have many bookable sessions.
--
-- IMPORTANT: this phase is purely additive. The legacy columns
-- `activities.date|time|max_seats|seats_remaining` stay in place
-- and remain the source of truth for now. Code is unchanged.
-- A mirror trigger is installed so any future write to either
-- side stays in sync until later phases finish the cutover.
--
-- Rollback: see bottom of file.
-- ============================================================

BEGIN;

-- Required for the per-activity overlap exclusion constraint
-- (combines equality on activity_id with the && range operator).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------
CREATE TABLE public.activity_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  max_seats       INTEGER NOT NULL CHECK (max_seats > 0),
  seats_remaining INTEGER NOT NULL CHECK (seats_remaining >= 0),
  status          activity_status NOT NULL DEFAULT 'published',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT session_seats_remaining_lte_max CHECK (seats_remaining <= max_seats),
  CONSTRAINT session_ends_after_start CHECK (ends_at > starts_at)
);

-- A 3h class at 10:00 must block any other session for that
-- activity from 10:00–13:00. The half-open range [start, end)
-- means back-to-back sessions (10:00–11:00 then 11:00–12:00)
-- are still allowed — they don't actually overlap.
ALTER TABLE public.activity_sessions
  ADD CONSTRAINT no_overlap_per_activity
  EXCLUDE USING gist (
    activity_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  );

CREATE INDEX idx_activity_sessions_activity_starts
  ON public.activity_sessions (activity_id, starts_at);
CREATE INDEX idx_activity_sessions_starts_status
  ON public.activity_sessions (starts_at)
  WHERE status = 'published';

CREATE TRIGGER set_activity_sessions_updated_at
  BEFORE UPDATE ON public.activity_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- Row level security — mirrors `activities`
-- ------------------------------------------------------------
ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;

-- Public can see sessions of published activities only.
CREATE POLICY "Anyone can read sessions of published activities"
  ON public.activity_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_sessions.activity_id
        AND a.status = 'published'
    )
  );

-- Instructors can read all sessions of their own activities
-- (drafts, completed, cancelled — anything they own).
CREATE POLICY "Instructors can read sessions of their own activities"
  ON public.activity_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.instructor_profiles ip ON a.instructor_id = ip.id
      WHERE a.id = activity_sessions.activity_id
        AND ip.user_id = auth.uid()
    )
  );

-- Same write privileges as activities.
CREATE POLICY "Instructors can insert sessions on their own activities"
  ON public.activity_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.instructor_profiles ip ON a.instructor_id = ip.id
      WHERE a.id = activity_sessions.activity_id
        AND ip.user_id = auth.uid()
        AND ip.approval_status = 'approved'
    )
  );

CREATE POLICY "Instructors can update sessions on their own activities"
  ON public.activity_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.instructor_profiles ip ON a.instructor_id = ip.id
      WHERE a.id = activity_sessions.activity_id
        AND ip.user_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete sessions on their own activities"
  ON public.activity_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.instructor_profiles ip ON a.instructor_id = ip.id
      WHERE a.id = activity_sessions.activity_id
        AND ip.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin full access to activity sessions"
  ON public.activity_sessions
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Bookers of a session can read it even after the activity is
-- no longer published (mirrors the policy on `activities` from
-- migration 00002). Re-uses the existing helper to dodge RLS
-- recursion on `bookings`.
CREATE POLICY "Users can read sessions they have booked"
  ON public.activity_sessions
  FOR SELECT
  USING (public.user_has_booking_for_activity(auth.uid(), activity_id));

-- ------------------------------------------------------------
-- Backfill: one session per existing activity row
-- ------------------------------------------------------------
-- Existing `activities.date` is a DATE in São Paulo wall-clock
-- and `activities.time` is a TIME in the same zone, so we
-- convert the pair to a UTC TIMESTAMPTZ via the SP zone before
-- storing. End time is derived from `duration_minutes`.
INSERT INTO public.activity_sessions (
  activity_id, starts_at, ends_at, max_seats, seats_remaining, status, created_at
)
SELECT
  a.id,
  ((a.date::timestamp + a.time::time) AT TIME ZONE 'America/Sao_Paulo'),
  ((a.date::timestamp + a.time::time) AT TIME ZONE 'America/Sao_Paulo')
    + (a.duration_minutes || ' minutes')::interval,
  a.max_seats,
  a.seats_remaining,
  CASE WHEN a.status = 'cancelled' THEN 'cancelled'::activity_status
       WHEN a.status = 'completed' THEN 'completed'::activity_status
       ELSE 'published'::activity_status
  END,
  a.created_at
FROM public.activities a;

-- ------------------------------------------------------------
-- Bookings ↔ sessions link
-- ------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN session_id UUID REFERENCES public.activity_sessions(id) ON DELETE RESTRICT;

-- Every existing booking maps to its activity's lone session
-- (1:1 right now; multi-session activities don't exist yet).
UPDATE public.bookings b
SET session_id = s.id
FROM public.activity_sessions s
WHERE s.activity_id = b.activity_id;

-- Lock it in. Future bookings without a session_id would be a bug.
ALTER TABLE public.bookings
  ALTER COLUMN session_id SET NOT NULL;

-- Guardrail: booking.activity_id must match its session's activity_id.
-- Cheap enforcement via a trigger (a CHECK can't reference another row).
CREATE OR REPLACE FUNCTION public.assert_booking_session_matches_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_session_activity UUID;
BEGIN
  SELECT activity_id INTO v_session_activity
  FROM public.activity_sessions
  WHERE id = NEW.session_id;

  IF v_session_activity IS DISTINCT FROM NEW.activity_id THEN
    RAISE EXCEPTION
      'booking.session_id (%) belongs to activity %, not booking.activity_id %',
      NEW.session_id, v_session_activity, NEW.activity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_session_matches_activity
  BEFORE INSERT OR UPDATE OF session_id, activity_id ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.assert_booking_session_matches_activity();

CREATE INDEX idx_bookings_session ON public.bookings(session_id);

-- ------------------------------------------------------------
-- Mirror trigger: keep legacy activity columns in sync with
-- the (still single) session row.
--
-- This trigger only operates while there's exactly one session
-- per activity, which is the invariant during phases 1-3.
-- Phase 4 (instructor UI for multi-session) will drop this
-- trigger and switch the legacy columns to read-only/derived.
-- ------------------------------------------------------------

-- activities -> activity_sessions
CREATE OR REPLACE FUNCTION public.mirror_activity_to_session()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT: create the matching session row.
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_sessions (
      activity_id, starts_at, ends_at, max_seats, seats_remaining, status
    ) VALUES (
      NEW.id,
      ((NEW.date::timestamp + NEW.time::time) AT TIME ZONE 'America/Sao_Paulo'),
      ((NEW.date::timestamp + NEW.time::time) AT TIME ZONE 'America/Sao_Paulo')
        + (NEW.duration_minutes || ' minutes')::interval,
      NEW.max_seats,
      NEW.seats_remaining,
      CASE WHEN NEW.status = 'cancelled' THEN 'cancelled'::activity_status
           WHEN NEW.status = 'completed' THEN 'completed'::activity_status
           ELSE 'published'::activity_status
      END
    );
    RETURN NEW;
  END IF;

  -- UPDATE: only reflect changes if the activity still has
  -- exactly one session (the single-session invariant). Once
  -- the instructor adds a second session, the activity row's
  -- date/time/seats columns become meaningless and we leave
  -- the sessions alone.
  IF (SELECT COUNT(*) FROM public.activity_sessions WHERE activity_id = NEW.id) = 1 THEN
    UPDATE public.activity_sessions
    SET
      starts_at       = ((NEW.date::timestamp + NEW.time::time) AT TIME ZONE 'America/Sao_Paulo'),
      ends_at         = ((NEW.date::timestamp + NEW.time::time) AT TIME ZONE 'America/Sao_Paulo')
                          + (NEW.duration_minutes || ' minutes')::interval,
      max_seats       = NEW.max_seats,
      seats_remaining = NEW.seats_remaining,
      status          = CASE WHEN NEW.status = 'cancelled' THEN 'cancelled'::activity_status
                             WHEN NEW.status = 'completed' THEN 'completed'::activity_status
                             ELSE 'published'::activity_status
                        END
    WHERE activity_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mirror_activities_to_sessions
  AFTER INSERT OR UPDATE OF date, time, duration_minutes, max_seats, seats_remaining, status
  ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.mirror_activity_to_session();

-- activity_sessions -> activities (keeps `seats_remaining` etc.
-- on the activity row in sync as bookings happen via the legacy
-- RPC, which still touches activities.seats_remaining today).
-- Same single-session guard as above.
CREATE OR REPLACE FUNCTION public.mirror_session_to_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.activity_sessions
  WHERE activity_id = NEW.activity_id;

  IF v_count = 1 THEN
    UPDATE public.activities a
    SET
      max_seats       = NEW.max_seats,
      seats_remaining = NEW.seats_remaining,
      status          = CASE WHEN NEW.status = 'cancelled' THEN 'cancelled'::activity_status
                             WHEN NEW.status = 'completed' THEN 'completed'::activity_status
                             ELSE a.status
                        END
    WHERE a.id = NEW.activity_id
      AND (
        a.max_seats        IS DISTINCT FROM NEW.max_seats
        OR a.seats_remaining IS DISTINCT FROM NEW.seats_remaining
        OR (NEW.status IN ('cancelled', 'completed') AND a.status IS DISTINCT FROM NEW.status)
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mirror_sessions_to_activities
  AFTER UPDATE OF max_seats, seats_remaining, status
  ON public.activity_sessions
  FOR EACH ROW EXECUTE FUNCTION public.mirror_session_to_activity();

COMMIT;

-- ============================================================
-- ROLLBACK (manual, if needed):
--
--   BEGIN;
--   DROP TRIGGER IF EXISTS mirror_sessions_to_activities ON public.activity_sessions;
--   DROP TRIGGER IF EXISTS mirror_activities_to_sessions ON public.activities;
--   DROP FUNCTION IF EXISTS public.mirror_session_to_activity();
--   DROP FUNCTION IF EXISTS public.mirror_activity_to_session();
--   DROP TRIGGER IF EXISTS bookings_session_matches_activity ON public.bookings;
--   DROP FUNCTION IF EXISTS public.assert_booking_session_matches_activity();
--   ALTER TABLE public.bookings DROP COLUMN IF EXISTS session_id;
--   DROP TABLE IF EXISTS public.activity_sessions;
--   COMMIT;
-- ============================================================
