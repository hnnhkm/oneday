-- ============================================================
-- Phase 9: scheduled-job primitives
--
-- Three SECURITY DEFINER SQL functions wrapped by a single daily
-- HTTP endpoint (see src/app/api/cron/daily/route.ts). The endpoint
-- is the thing an external scheduler calls — these functions just
-- do the DB work.
--
--   1. auto_complete_past_activities()
--      Flips published activities with a past date to 'completed',
--      and their confirmed/pending bookings to 'completed' too.
--      Idempotent (the WHERE clauses filter out already-completed
--      rows), so running the job twice in a row is a no-op.
--
--   2. queue_activity_reminders(p_target_date DATE)
--      Inserts an activity_reminder notification for every
--      confirmed booking where the activity is on p_target_date
--      (defaults to tomorrow) and no reminder has been stamped
--      yet. Dedupes via bookings.reminder_sent_at.
--
--   3. queue_review_prompts(p_target_date DATE)
--      Inserts a review_prompt notification for every completed
--      booking where the activity happened on p_target_date
--      (defaults to yesterday), the user hasn't reviewed yet,
--      and review_prompt_sent_at is null. Dedupes via
--      bookings.review_prompt_sent_at.
--
-- Both reminder/prompt functions return the set of affected user
-- ids so the caller can drain their email inboxes via the existing
-- Phase 7 dispatcher without having to re-query.
-- ============================================================

-- Dedup columns. A NULL means "never sent".
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS review_prompt_sent_at TIMESTAMPTZ;

-- ------------------------------------------------------------------
-- auto_complete_past_activities
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_complete_past_activities()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Flip bookings first so the cancel-trigger guard (which checks
  -- activity.status <> 'cancelled') sees the right state. Completion
  -- shouldn't fire the booking-cancel trigger anyway since we're
  -- moving to 'completed', not 'cancelled'.
  UPDATE public.bookings AS b
  SET status = 'completed'
  FROM public.activities AS a
  WHERE b.activity_id = a.id
    AND a.status = 'published'
    AND a.date < CURRENT_DATE
    AND b.status = 'confirmed';

  WITH flipped AS (
    UPDATE public.activities
    SET status = 'completed'
    WHERE status = 'published'
      AND date < CURRENT_DATE
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM flipped;

  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------
-- queue_activity_reminders
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_activity_reminders(
  p_target_date DATE DEFAULT (CURRENT_DATE + INTERVAL '1 day')::DATE
)
RETURNS TABLE(affected_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH eligible AS (
    SELECT b.id AS booking_id, b.user_id AS booker_id, a.title, a.date, a.time
    FROM public.bookings b
    JOIN public.activities a ON a.id = b.activity_id
    WHERE b.status = 'confirmed'
      AND b.reminder_sent_at IS NULL
      AND a.date = p_target_date
      AND a.status = 'published'
  ),
  inserted AS (
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    SELECT
      e.booker_id,
      'activity_reminder',
      'Lembrete: atividade amanhã',
      format(
        'Sua atividade "%s" acontece amanhã às %s. Até lá!',
        COALESCE(e.title->>'pt', 'atividade'),
        to_char(e.time, 'HH24:MI')
      ),
      'in_app'
    FROM eligible e
    RETURNING id
  ),
  stamped AS (
    UPDATE public.bookings
    SET reminder_sent_at = now()
    WHERE id IN (SELECT booking_id FROM eligible)
    RETURNING user_id
  )
  SELECT DISTINCT s.user_id FROM stamped s;
END;
$$;

-- ------------------------------------------------------------------
-- queue_review_prompts
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_review_prompts(
  p_target_date DATE DEFAULT (CURRENT_DATE - INTERVAL '1 day')::DATE
)
RETURNS TABLE(affected_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH eligible AS (
    SELECT b.id AS booking_id, b.user_id AS booker_id, a.title
    FROM public.bookings b
    JOIN public.activities a ON a.id = b.activity_id
    WHERE b.status = 'completed'
      AND b.review_prompt_sent_at IS NULL
      AND a.date = p_target_date
      AND NOT EXISTS (
        SELECT 1 FROM public.reviews r
        WHERE r.user_id = b.user_id
          AND r.activity_id = b.activity_id
      )
  ),
  inserted AS (
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    SELECT
      e.booker_id,
      'review_prompt',
      'Como foi sua atividade?',
      format(
        'Conte sua experiência em "%s". Sua avaliação ajuda outros participantes!',
        COALESCE(e.title->>'pt', 'atividade')
      ),
      'in_app'
    FROM eligible e
    RETURNING id
  ),
  stamped AS (
    UPDATE public.bookings
    SET review_prompt_sent_at = now()
    WHERE id IN (SELECT booking_id FROM eligible)
    RETURNING user_id
  )
  SELECT DISTINCT s.user_id FROM stamped s;
END;
$$;
