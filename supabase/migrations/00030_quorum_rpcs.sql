-- ============================================================
-- Phase 12: quorum RPCs.
--
-- Four RPCs:
--   1. confirm_session_quorum(session_id) — instructor override
--      flips at_risk → confirmed
--   2. evaluate_session_quorum() — cron job: finds sub-min
--      sessions in the 22-26h window, flips to at_risk, notifies
--      instructor
--   3. expire_at_risk_sessions() — cron job: finds at_risk
--      sessions past the 2h confirmation window, delegates to
--      cancel_session_with_refunds (shared code path)
--
-- Plus amendments to book_session and book_session_from_webhook
-- so that when a booking takes booked-seats >= min_participants,
-- quorum_state flips to 'confirmed' and every existing booking
-- on the session receives a session_confirmed notification.
-- ============================================================

BEGIN;

-- --------------------------------------------------------------
-- confirm_session_quorum(session_id)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_session_quorum(
  p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid   UUID := auth.uid();
  v_profile_id   UUID;
  v_session      RECORD;
  v_booking      RECORD;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT ip.id INTO v_profile_id
  FROM public.instructor_profiles ip
  WHERE ip.user_id = v_caller_uid
    AND ip.approval_status = 'approved';

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT s.id, s.activity_id, s.quorum_state,
         COALESCE(a.title->>'pt', 'atividade') AS title_pt,
         a.instructor_id
  INTO v_session
  FROM public.activity_sessions s
  JOIN public.activities a ON a.id = s.activity_id
  WHERE s.id = p_session_id
  FOR UPDATE OF s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.instructor_id <> v_profile_id THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF v_session.quorum_state = 'confirmed' THEN
    RAISE EXCEPTION 'already_confirmed' USING ERRCODE = 'P0001';
  END IF;

  IF v_session.quorum_state = 'cancelled' THEN
    RAISE EXCEPTION 'already_cancelled' USING ERRCODE = 'P0001';
  END IF;

  IF v_session.quorum_state <> 'at_risk' THEN
    RAISE EXCEPTION 'not_at_risk' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.activity_sessions
  SET quorum_state = 'confirmed',
      instructor_confirmed_at = now(),
      updated_at = now()
  WHERE id = p_session_id
    AND quorum_state = 'at_risk';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'already_cancelled' USING ERRCODE = 'P0001';
  END IF;

  -- Notify each booked participant.
  FOR v_booking IN
    SELECT user_id
    FROM public.bookings
    WHERE session_id = p_session_id
      AND status <> 'cancelled'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      v_booking.user_id,
      'session_confirmed',
      'Aula confirmada',
      format(
        'Boa notícia! A sessão de "%s" foi confirmada. Até lá!',
        v_session.title_pt
      ),
      'in_app'
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_session_quorum(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_session_quorum(UUID) TO authenticated;

-- --------------------------------------------------------------
-- evaluate_session_quorum()
--
-- Runs hourly via /api/cron/hourly. Returns the set of instructor
-- user ids that got a new notification, so the route can drain
-- emails for them.
--
-- The 22-26h window is intentionally wider than 24h: a delayed
-- cron run still catches its sessions. `quorum_state = 'pending'`
-- prevents double-flipping on the next run.
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_session_quorum()
RETURNS TABLE(affected_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH flagged AS (
    UPDATE public.activity_sessions s
    SET quorum_state = 'at_risk',
        quorum_evaluated_at = now(),
        updated_at = now()
    FROM public.activities a
    WHERE s.activity_id = a.id
      AND s.quorum_state = 'pending'
      AND s.status = 'published'
      AND a.min_participants > 0
      AND (s.max_seats - s.seats_remaining) < a.min_participants
      AND s.starts_at BETWEEN now() + INTERVAL '22 hours' AND now() + INTERVAL '26 hours'
    RETURNING s.id AS session_id,
              s.activity_id,
              s.starts_at,
              s.max_seats,
              s.seats_remaining,
              a.instructor_id,
              a.min_participants,
              COALESCE(a.title->>'pt', 'atividade') AS title_pt
  ),
  instructor_lookup AS (
    SELECT f.session_id, f.starts_at, f.max_seats, f.seats_remaining,
           f.min_participants, f.title_pt, ip.user_id AS instructor_user_id
    FROM flagged f
    JOIN public.instructor_profiles ip ON ip.id = f.instructor_id
  ),
  inserted AS (
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    SELECT
      il.instructor_user_id,
      'session_quorum_at_risk',
      'Sessão abaixo do mínimo',
      format(
        'A sessão de "%s" está abaixo do mínimo: %s/%s participantes. Confirme que vai rodar dentro de 2h, caso contrário ela será cancelada automaticamente.',
        il.title_pt,
        il.max_seats - il.seats_remaining,
        il.min_participants
      ),
      'in_app'
    FROM instructor_lookup il
    RETURNING user_id
  )
  SELECT DISTINCT user_id FROM inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_session_quorum() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_session_quorum() TO service_role;

-- --------------------------------------------------------------
-- expire_at_risk_sessions()
--
-- For each at_risk session past the 2h confirmation window with
-- no instructor override, call cancel_session_with_refunds.
-- Returns the set of user ids that got booking_cancelled
-- notifications so the route can drain emails.
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_at_risk_sessions()
RETURNS TABLE(affected_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_user_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  FOR v_session_id IN
    SELECT id
    FROM public.activity_sessions
    WHERE quorum_state = 'at_risk'
      AND instructor_confirmed_at IS NULL
      AND quorum_evaluated_at + INTERVAL '2 hours' <= now()
      AND starts_at > now()
  LOOP
    -- Capture user_ids of not-yet-cancelled bookings BEFORE the cancel
    -- flips them. The cancel will insert booking_cancelled notifications
    -- for exactly these users.
    v_user_ids := v_user_ids || (
      SELECT COALESCE(array_agg(b.user_id), ARRAY[]::UUID[])
      FROM public.bookings b
      WHERE b.session_id = v_session_id
        AND b.status <> 'cancelled'
    );
    PERFORM public.cancel_session_with_refunds(v_session_id, 'quorum_not_met');
  END LOOP;

  RETURN QUERY
  SELECT DISTINCT u FROM unnest(v_user_ids) AS u WHERE u IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_at_risk_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_at_risk_sessions() TO service_role;

-- --------------------------------------------------------------
-- Amend book_session + book_session_from_webhook for auto-confirm.
--
-- Both RPCs already decrement seats_remaining. We add a tail step:
-- if the session's activity has a min and booked (= max - remaining)
-- now meets or exceeds it, flip quorum_state and notify every
-- already-booked participant.
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maybe_auto_confirm_quorum(
  p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_info    RECORD;
  v_booking RECORD;
BEGIN
  SELECT s.id, s.quorum_state, s.max_seats, s.seats_remaining,
         a.min_participants,
         COALESCE(a.title->>'pt', 'atividade') AS title_pt
  INTO v_info
  FROM public.activity_sessions s
  JOIN public.activities a ON a.id = s.activity_id
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_info.min_participants = 0 THEN
    RETURN;
  END IF;

  -- Only flip from pending/at_risk; never un-cancel or re-confirm.
  IF v_info.quorum_state NOT IN ('pending', 'at_risk') THEN
    RETURN;
  END IF;

  IF (v_info.max_seats - v_info.seats_remaining) < v_info.min_participants THEN
    RETURN;
  END IF;

  UPDATE public.activity_sessions
  SET quorum_state = 'confirmed',
      updated_at = now()
  WHERE id = p_session_id;

  FOR v_booking IN
    SELECT user_id
    FROM public.bookings
    WHERE session_id = p_session_id
      AND status <> 'cancelled'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      v_booking.user_id,
      'session_confirmed',
      'Aula confirmada',
      format(
        'Boa notícia! A sessão de "%s" foi confirmada. Até lá!',
        v_info.title_pt
      ),
      'in_app'
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_auto_confirm_quorum(UUID) FROM PUBLIC;
-- Called only from other SECURITY DEFINER functions; no grants needed.

-- Re-declare book_session with a PERFORM at the tail. The body up
-- to the INSERT is identical to 00022_book_session_rpcs.sql; we
-- replace the whole function so callers see one atomic version.
CREATE OR REPLACE FUNCTION public.book_session(
  p_user_id    uuid,
  p_session_id uuid,
  p_seats      integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session             record;
  v_activity            record;
  v_total_price         integer;
  v_booking_id          uuid;
  v_instructor_user_id  uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be >= 1' USING ERRCODE = '22023';
  END IF;

  SELECT id, activity_id, starts_at, seats_remaining, status
  INTO v_session
  FROM public.activity_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status <> 'published' THEN
    RAISE EXCEPTION 'session is not bookable' USING ERRCODE = '22023';
  END IF;

  IF v_session.starts_at < now() THEN
    RAISE EXCEPTION 'session has already started' USING ERRCODE = '22023';
  END IF;

  IF v_session.seats_remaining < p_seats THEN
    RAISE EXCEPTION 'not enough seats remaining' USING ERRCODE = '22023';
  END IF;

  SELECT id, price_cents, status, instructor_id
  INTO v_activity
  FROM public.activities
  WHERE id = v_session.activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_activity.status <> 'published' THEN
    RAISE EXCEPTION 'activity is not bookable' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_instructor_user_id
  FROM public.instructor_profiles
  WHERE id = v_activity.instructor_id;

  IF v_instructor_user_id = p_user_id THEN
    RAISE EXCEPTION 'cannot book your own activity' USING ERRCODE = '22023';
  END IF;

  v_total_price := v_activity.price_cents * p_seats;

  UPDATE public.activity_sessions
  SET seats_remaining = seats_remaining - p_seats
  WHERE id = p_session_id;

  INSERT INTO public.bookings (
    user_id, activity_id, session_id, seats_booked, total_price_cents,
    status, payment_status
  ) VALUES (
    p_user_id, v_session.activity_id, p_session_id, p_seats, v_total_price,
    'confirmed', 'paid'
  )
  RETURNING id INTO v_booking_id;

  -- NEW: auto-confirm quorum if this booking just pushed us over.
  PERFORM public.maybe_auto_confirm_quorum(p_session_id);

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_session(uuid, uuid, integer) TO authenticated;

-- Same amendment for the webhook variant. We reuse the original
-- function text and append the PERFORM before RETURN.
CREATE OR REPLACE FUNCTION public.book_session_from_webhook(
  p_user_id           uuid,
  p_session_id        uuid,
  p_seats             integer,
  p_stripe_session_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session             record;
  v_activity            record;
  v_total_price         integer;
  v_booking_id          uuid;
  v_existing_id         uuid;
  v_instructor_user_id  uuid;
BEGIN
  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be >= 1' USING ERRCODE = '22023';
  END IF;

  IF p_stripe_session_id IS NULL OR length(p_stripe_session_id) = 0 THEN
    RAISE EXCEPTION 'stripe session id required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.bookings
  WHERE stripe_session_id = p_stripe_session_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT id, activity_id, starts_at, seats_remaining, status
  INTO v_session
  FROM public.activity_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status <> 'published' THEN
    RAISE EXCEPTION 'session is not bookable' USING ERRCODE = '22023';
  END IF;

  IF v_session.starts_at < now() THEN
    RAISE EXCEPTION 'session has already started' USING ERRCODE = '22023';
  END IF;

  IF v_session.seats_remaining < p_seats THEN
    RAISE EXCEPTION 'not enough seats remaining' USING ERRCODE = '22023';
  END IF;

  SELECT id, price_cents, status, instructor_id
  INTO v_activity
  FROM public.activities
  WHERE id = v_session.activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_activity.status <> 'published' THEN
    RAISE EXCEPTION 'activity is not bookable' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_instructor_user_id
  FROM public.instructor_profiles
  WHERE id = v_activity.instructor_id;

  IF v_instructor_user_id = p_user_id THEN
    RAISE EXCEPTION 'cannot book your own activity' USING ERRCODE = '22023';
  END IF;

  v_total_price := v_activity.price_cents * p_seats;

  UPDATE public.activity_sessions
  SET seats_remaining = seats_remaining - p_seats
  WHERE id = p_session_id;

  INSERT INTO public.bookings (
    user_id, activity_id, session_id, seats_booked, total_price_cents,
    status, payment_status, stripe_session_id
  ) VALUES (
    p_user_id, v_session.activity_id, p_session_id, p_seats, v_total_price,
    'confirmed', 'paid', p_stripe_session_id
  )
  RETURNING id INTO v_booking_id;

  PERFORM public.maybe_auto_confirm_quorum(p_session_id);

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_session_from_webhook(uuid, uuid, integer, text) TO service_role;

COMMIT;
