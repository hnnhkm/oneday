-- ============================================================
-- Phase 6: cancel_activity_with_refunds
--
-- Atomic cancel flow for an instructor-initiated activity cancel:
--   1. Verify ownership and that the activity is still cancellable.
--   2. Flip each non-cancelled booking → cancelled + refunded.
--   3. Insert a booking_cancelled notification row for each affected
--      booker (the function is SECURITY DEFINER so it can write to
--      notifications owned by other users).
--   4. Flip the activity status → cancelled.
--
-- Everything runs in a single transaction; partial failure is not
-- possible. Returns the count of affected bookings for UI toast.
-- ============================================================

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
  v_date DATE;
  v_title TEXT;
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

  SELECT a.status, a.date, COALESCE(a.title->>'pt', 'atividade')
    INTO v_status, v_date, v_title
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

  IF v_date < CURRENT_DATE THEN
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

  UPDATE public.activities
  SET status = 'cancelled'
  WHERE id = p_activity_id;

  RETURN v_affected;
END;
$$;

-- Only authenticated users need to call this; grant EXECUTE.
REVOKE ALL ON FUNCTION public.cancel_activity_with_refunds(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_activity_with_refunds(UUID, TEXT) TO authenticated;
