-- Phase 12: instructors are also regular users.
--
-- The data model (RLS + server actions) already allows any
-- authenticated user to book/favorite/review any activity
-- regardless of their role, so approved instructors can freely
-- browse and enroll in other instructors' classes. What was NOT
-- blocked: instructors booking their own activities, which would
-- let them inflate seat counts and effectively pay themselves
-- (minus platform commission) on their own inventory.
--
-- This migration adds a self-booking guard to both book_activity
-- variants (user-initiated and webhook-initiated). The check is a
-- single JOIN against instructor_profiles — cheap, and it runs
-- *inside* the locked transaction so it's race-proof.

CREATE OR REPLACE FUNCTION public.book_activity(
  p_user_id uuid,
  p_activity_id uuid,
  p_seats integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

  -- Lock the activity row for the duration of the transaction.
  SELECT id, price_cents, seats_remaining, status, date, instructor_id
  INTO v_activity
  FROM public.activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity not found' USING ERRCODE = 'P0002';
  END IF;

  -- Self-booking guard. Look up the owning instructor's user_id
  -- and reject if it matches the booker.
  SELECT user_id INTO v_instructor_user_id
  FROM public.instructor_profiles
  WHERE id = v_activity.instructor_id;

  IF v_instructor_user_id = p_user_id THEN
    RAISE EXCEPTION 'cannot book your own activity' USING ERRCODE = '22023';
  END IF;

  IF v_activity.status <> 'published' THEN
    RAISE EXCEPTION 'activity is not bookable' USING ERRCODE = '22023';
  END IF;

  IF v_activity.date < CURRENT_DATE THEN
    RAISE EXCEPTION 'activity is in the past' USING ERRCODE = '22023';
  END IF;

  IF v_activity.seats_remaining < p_seats THEN
    RAISE EXCEPTION 'not enough seats remaining' USING ERRCODE = '22023';
  END IF;

  v_total_price := v_activity.price_cents * p_seats;

  UPDATE public.activities
  SET seats_remaining = seats_remaining - p_seats
  WHERE id = p_activity_id;

  INSERT INTO public.bookings (
    user_id, activity_id, seats_booked, total_price_cents,
    status, payment_status
  ) VALUES (
    p_user_id, p_activity_id, p_seats, v_total_price,
    'confirmed', 'paid'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_activity(uuid, uuid, integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.book_activity_from_webhook(
  p_user_id uuid,
  p_activity_id uuid,
  p_seats integer,
  p_session_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity record;
  v_total_price integer;
  v_booking_id uuid;
  v_existing_id uuid;
  v_instructor_user_id uuid;
BEGIN
  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be >= 1' USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NULL OR length(p_session_id) = 0 THEN
    RAISE EXCEPTION 'session id required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.bookings
  WHERE stripe_session_id = p_session_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT id, price_cents, seats_remaining, status, date, instructor_id
  INTO v_activity
  FROM public.activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity not found' USING ERRCODE = 'P0002';
  END IF;

  -- Self-booking guard: belt-and-suspenders for the webhook path.
  -- The client-side checkout action already pre-checks, but a
  -- hand-crafted request to Stripe (or a bug in the action) could
  -- still land here, and we don't want a half-materialized booking
  -- to leak through.
  SELECT user_id INTO v_instructor_user_id
  FROM public.instructor_profiles
  WHERE id = v_activity.instructor_id;

  IF v_instructor_user_id = p_user_id THEN
    RAISE EXCEPTION 'cannot book your own activity' USING ERRCODE = '22023';
  END IF;

  IF v_activity.status <> 'published' THEN
    RAISE EXCEPTION 'activity is not bookable' USING ERRCODE = '22023';
  END IF;

  IF v_activity.date < CURRENT_DATE THEN
    RAISE EXCEPTION 'activity is in the past' USING ERRCODE = '22023';
  END IF;

  IF v_activity.seats_remaining < p_seats THEN
    RAISE EXCEPTION 'not enough seats remaining' USING ERRCODE = '22023';
  END IF;

  v_total_price := v_activity.price_cents * p_seats;

  UPDATE public.activities
  SET seats_remaining = seats_remaining - p_seats
  WHERE id = p_activity_id;

  INSERT INTO public.bookings (
    user_id, activity_id, seats_booked, total_price_cents,
    status, payment_status, stripe_session_id
  ) VALUES (
    p_user_id, p_activity_id, p_seats, v_total_price,
    'confirmed', 'paid', p_session_id
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.book_activity_from_webhook(uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_activity_from_webhook(uuid, uuid, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.book_activity_from_webhook(uuid, uuid, integer, text) TO service_role;
