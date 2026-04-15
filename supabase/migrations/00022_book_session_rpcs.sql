-- ============================================================
-- Phase 3 of the activity-sessions split.
--
-- Introduces session-level booking RPCs that lock and decrement
-- `activity_sessions` directly. Application code (createBooking
-- Action, createCheckoutSessionAction, the Stripe webhook, and
-- cancelBookingAction) migrates to these RPCs in the same release.
--
-- The legacy `book_activity(...)` and `book_activity_from_webhook(...)`
-- RPCs stay intact for one release as a safety net — they still work
-- because the mirror trigger installed in 00020 keeps sessions and
-- activities in sync while each activity has exactly one session.
-- Phase 6 drops them alongside the legacy columns.
--
-- Key differences vs. the legacy RPCs:
--   * Lock `activity_sessions` (FOR UPDATE), not activities.
--   * Enforce "can't book a session that already started" via
--     starts_at < now(), instead of the coarser date < CURRENT_DATE.
--   * Decrement session.seats_remaining. Mirror trigger propagates
--     the decrement to activities.seats_remaining while single-session.
--     Once multi-session lands (Phase 4), the activity column stops
--     being mirrored and session.seats_remaining becomes the only
--     source of truth — which is what we want.
--   * Bookings are inserted with BOTH session_id and activity_id.
--     The assert_booking_session_matches_activity trigger (00020)
--     enforces consistency between the two.
--
-- Rollback: see bottom of file.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- User-initiated booking: session variant.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_session(
  p_user_id uuid,
  p_session_id uuid,
  p_seats integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_activity record;
  v_total_price integer;
  v_booking_id uuid;
  v_instructor_user_id uuid;
BEGIN
  -- Authz: caller must be booking for themselves.
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be >= 1' USING ERRCODE = '22023';
  END IF;

  -- Lock the session row for the rest of the transaction so two
  -- concurrent callers cannot both grab the last seat.
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

  -- Pull the activity row purely for price + self-booking guard. We
  -- do NOT lock it — all seat state lives on the session, and the
  -- FK from session to activity prevents the activity from being
  -- deleted while we hold the session lock.
  SELECT id, price_cents, status, instructor_id
  INTO v_activity
  FROM public.activities
  WHERE id = v_session.activity_id;

  IF NOT FOUND THEN
    -- Can't happen given the FK, but be defensive.
    RAISE EXCEPTION 'activity not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_activity.status <> 'published' THEN
    RAISE EXCEPTION 'activity is not bookable' USING ERRCODE = '22023';
  END IF;

  -- Self-booking guard: instructors cannot book their own activities
  -- (they could inflate seat counts and effectively pay themselves
  -- minus commission).
  SELECT user_id INTO v_instructor_user_id
  FROM public.instructor_profiles
  WHERE id = v_activity.instructor_id;

  IF v_instructor_user_id = p_user_id THEN
    RAISE EXCEPTION 'cannot book your own activity' USING ERRCODE = '22023';
  END IF;

  v_total_price := v_activity.price_cents * p_seats;

  -- Decrement session seats first so a failed insert rolls everything back.
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

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_session(uuid, uuid, integer) TO authenticated;


-- ------------------------------------------------------------
-- Webhook-initiated booking: session variant.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_session_from_webhook(
  p_user_id uuid,
  p_session_id uuid,
  p_seats integer,
  p_stripe_session_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_activity record;
  v_total_price integer;
  v_booking_id uuid;
  v_existing_id uuid;
  v_instructor_user_id uuid;
BEGIN
  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be >= 1' USING ERRCODE = '22023';
  END IF;

  IF p_stripe_session_id IS NULL OR length(p_stripe_session_id) = 0 THEN
    RAISE EXCEPTION 'stripe session id required' USING ERRCODE = '22023';
  END IF;

  -- Idempotency: Stripe retries webhooks on 5xx. If we already
  -- materialized this checkout session, return the same booking id
  -- and do nothing else.
  SELECT id INTO v_existing_id
  FROM public.bookings
  WHERE stripe_session_id = p_stripe_session_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- Lock the session for the duration of the transaction.
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

  -- Self-booking guard: belt-and-suspenders for the webhook path.
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

  RETURN v_booking_id;
END;
$$;

-- Service-role only (matches the legacy webhook RPC grants).
REVOKE ALL ON FUNCTION public.book_session_from_webhook(uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_session_from_webhook(uuid, uuid, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.book_session_from_webhook(uuid, uuid, integer, text) TO service_role;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, if needed):
--
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.book_session_from_webhook(uuid, uuid, integer, text);
--   DROP FUNCTION IF EXISTS public.book_session(uuid, uuid, integer);
--   COMMIT;
-- ============================================================
