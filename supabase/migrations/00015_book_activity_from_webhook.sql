-- Phase 9: Stripe webhook path
--
-- The existing book_activity(uuid, uuid, integer) function enforces
-- auth.uid() = p_user_id so a user can only book for themselves. The
-- Stripe webhook has no logged-in user context — it runs as the
-- service role and needs to materialize a booking on behalf of the
-- user identified in checkout.session.metadata.
--
-- This companion function:
--   * Does not check auth.uid() (service role only, see GRANT below)
--   * Is idempotent via the unique index on stripe_session_id: if a
--     booking already exists for that session, return its id without
--     double-spending the seat.
--   * Locks the activity row like book_activity so concurrent webhook
--     retries + direct user bookings cannot race.
--   * Writes stripe_session_id so /checkout/success can find the
--     booking and redirect the user to the confirmation page.

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
BEGIN
  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be >= 1' USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NULL OR length(p_session_id) = 0 THEN
    RAISE EXCEPTION 'session id required' USING ERRCODE = '22023';
  END IF;

  -- Idempotency: Stripe retries webhooks on 5xx. If we already
  -- materialized this session, return the same booking id and do
  -- nothing else. The unique index on stripe_session_id also guards
  -- the insert below as a belt-and-suspenders check.
  SELECT id INTO v_existing_id
  FROM public.bookings
  WHERE stripe_session_id = p_session_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- Lock the activity row for the duration of the transaction.
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

-- Service role only. The function is SECURITY DEFINER but we still
-- revoke EXECUTE from PUBLIC/authenticated so it can never be reached
-- from user code paths — only the server-only webhook handler, which
-- uses the service-role client, should call this.
REVOKE ALL ON FUNCTION public.book_activity_from_webhook(uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_activity_from_webhook(uuid, uuid, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.book_activity_from_webhook(uuid, uuid, integer, text) TO service_role;
