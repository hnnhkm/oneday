-- ============================================================
-- Phase 2 of the activity-sessions split.
--
-- Adds generated "local-wall-clock" columns on `activity_sessions`
-- so PostgREST queries can filter by date range and time-of-day
-- against the session (not the legacy activity columns).
--
-- São Paulo abolished DST in November 2019, so the -03:00 offset
-- is stable year-round and `GENERATED ALWAYS ... STORED` is safe.
-- If Brazil ever re-introduces DST, we'd migrate these to VIRTUAL
-- or regenerate values manually.
--
-- Indexes support the two filter shapes used by search/filter:
--   - local_date: range scan for date window + "future only" filters
--   - local_time: range scan for morning/afternoon/evening buckets
--
-- Rollback: see bottom of file.
-- ============================================================

BEGIN;

ALTER TABLE public.activity_sessions
  ADD COLUMN local_date DATE
    GENERATED ALWAYS AS (((starts_at AT TIME ZONE 'America/Sao_Paulo'))::date) STORED,
  ADD COLUMN local_time TIME
    GENERATED ALWAYS AS (((starts_at AT TIME ZONE 'America/Sao_Paulo'))::time) STORED;

-- Date-window queries are always combined with status='published',
-- so a partial index is enough and stays small.
CREATE INDEX idx_activity_sessions_local_date_published
  ON public.activity_sessions (local_date)
  WHERE status = 'published';

-- Time-of-day filter. Kept non-partial so it also covers non-published
-- reads (instructor calendars etc.) if we later generalise.
CREATE INDEX idx_activity_sessions_local_time
  ON public.activity_sessions (local_time);

COMMIT;

-- ============================================================
-- ROLLBACK (manual, if needed):
--
--   BEGIN;
--   DROP INDEX IF EXISTS idx_activity_sessions_local_time;
--   DROP INDEX IF EXISTS idx_activity_sessions_local_date_published;
--   ALTER TABLE public.activity_sessions DROP COLUMN IF EXISTS local_time;
--   ALTER TABLE public.activity_sessions DROP COLUMN IF EXISTS local_date;
--   COMMIT;
-- ============================================================
