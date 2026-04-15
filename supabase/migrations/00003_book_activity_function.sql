-- Atomic booking creation.
-- Wraps the seat-availability check, seat decrement, and booking insert in a
-- single transaction with row-level locking on the activities row, so two
-- concurrent callers cannot both grab the last seat.
--
-- Uses SECURITY DEFINER so the function can decrement activities.seats_remaining
-- (regular users have no UPDATE privilege on activities). All authorization is
-- enforced by an explicit p_user_id = auth.uid() check inside the function.
--
-- Payment is mocked: bookings are inserted with payment_status='paid' and
-- status='confirmed'. When real Stripe is wired up, callers will instead create
-- a 'pending' booking and a webhook will flip it to 'paid'/'confirmed'.

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
BEGIN
  -- Authz: caller must be booking for themselves.
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be >= 1' USING ERRCODE = '22023';
  END IF;

  -- Lock the activity row for the duration of the transaction so concurrent
  -- bookings cannot both read the same seats_remaining and double-spend.
  SELECT id, price_cents, seats_remaining, status, date
  INTO v_activity
  FROM public.activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity not found' USING ERRCODE = 'P0002';
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

  -- Decrement seats first so a failure of the insert rolls everything back.
  UPDATE public.activities
  SET seats_remaining = seats_remaining - p_seats
  WHERE id = p_activity_id;

  -- Mock payment: confirmed + paid up front.
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
