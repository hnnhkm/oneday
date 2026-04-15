-- ============================================================
-- Phase 10: admin moderation primitives
--
-- Mirrors cancel_activity_with_refunds from 00005/00006 but skips
-- the instructor ownership check. Instead we verify that the
-- caller has role='admin' on users — this function is only
-- callable from the authenticated admin session.
--
-- Atomic by default (single PL/pgSQL block runs in one txn): flips
-- the activity → cancelled, cancels + refunds every active
-- booking, inserts a richer booking_cancelled notification for each
-- affected booker.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_cancel_activity_with_refunds(
  p_activity_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
  v_status activity_status;
  v_date DATE;
  v_title TEXT;
  v_affected INT := 0;
  v_booking RECORD;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.users
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT a.status, a.date, COALESCE(a.title->>'pt', 'atividade')
    INTO v_status, v_date, v_title
  FROM public.activities a
  WHERE a.id = p_activity_id;

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

  -- Flip activity FIRST so the booking-cancel trigger sees
  -- activity.status='cancelled' and skips its own notification
  -- insert (same ordering trick as cancel_activity_with_refunds).
  UPDATE public.activities
  SET status = 'cancelled'
  WHERE id = p_activity_id;

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
      'Atividade cancelada por moderação',
      CASE
        WHEN p_reason IS NULL OR length(trim(p_reason)) = 0
          THEN format('A atividade "%s" foi cancelada pela equipe do Hobby Marketplace. Seu pagamento será reembolsado.', v_title)
        ELSE format('A atividade "%s" foi cancelada pela equipe do Hobby Marketplace. Motivo: %s. Seu pagamento será reembolsado.', v_title, trim(p_reason))
      END,
      'in_app'
    );

    v_affected := v_affected + 1;
  END LOOP;

  RETURN v_affected;
END;
$$;

-- Grant to authenticated; the function's own role check gates it.
REVOKE ALL ON FUNCTION public.admin_cancel_activity_with_refunds(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_activity_with_refunds(UUID, TEXT) TO authenticated;
