-- ============================================================
-- Phase 6.5: notification triggers
--
-- Wires Postgres triggers so the notifications table starts filling
-- automatically for the happy paths that already exist:
--
--   INSERT on bookings (confirmed)  -> booker + instructor
--   UPDATE bookings -> cancelled    -> booker + instructor
--     (unless the parent activity was just cancelled; in that case
--      cancel_activity_with_refunds already inserted richer rows
--      with the instructor-supplied reason — see reorder below)
--   UPDATE instructor_profiles.approval_status
--     pending -> approved/rejected  -> applicant
--
-- All trigger functions run SECURITY DEFINER so they can write into
-- notifications rows owned by other users (RLS on notifications has
-- no INSERT policy for regular users).
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Booking INSERT -> booker + instructor
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_booking_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_instructor_user UUID;
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(a.title->>'pt', 'atividade'), ip.user_id
    INTO v_title, v_instructor_user
  FROM public.activities a
  JOIN public.instructor_profiles ip ON ip.id = a.instructor_id
  WHERE a.id = NEW.activity_id;

  -- Booker's confirmation
  INSERT INTO public.notifications (user_id, type, title, body, channel)
  VALUES (
    NEW.user_id,
    'booking_confirmed',
    'Reserva confirmada',
    format('Sua reserva em "%s" foi confirmada. Até lá!', v_title),
    'in_app'
  );

  -- Instructor heads-up. Same type, different recipient + text.
  IF v_instructor_user IS NOT NULL AND v_instructor_user <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      v_instructor_user,
      'booking_confirmed',
      'Nova reserva',
      format('Você recebeu uma nova reserva em "%s".', v_title),
      'in_app'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_booking_insert ON public.bookings;
CREATE TRIGGER trg_notify_on_booking_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_booking_insert();

-- ------------------------------------------------------------------
-- 2. Booking UPDATE -> cancelled (user-initiated only)
-- ------------------------------------------------------------------
-- Guard condition: if the parent activity has ALREADY been flipped to
-- 'cancelled' (cancel_activity_with_refunds reorder below), skip — the
-- function inserts its own richer rows with the cancellation reason.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_booking_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_instructor_user UUID;
  v_activity_status activity_status;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(a.title->>'pt', 'atividade'),
    ip.user_id,
    a.status
    INTO v_title, v_instructor_user, v_activity_status
  FROM public.activities a
  JOIN public.instructor_profiles ip ON ip.id = a.instructor_id
  WHERE a.id = NEW.activity_id;

  -- Activity-cancel path already wrote the notification.
  IF v_activity_status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, channel)
  VALUES (
    NEW.user_id,
    'booking_cancelled',
    'Reserva cancelada',
    format('Sua reserva em "%s" foi cancelada.', v_title),
    'in_app'
  );

  IF v_instructor_user IS NOT NULL AND v_instructor_user <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      v_instructor_user,
      'booking_cancelled',
      'Reserva cancelada pelo participante',
      format('Uma reserva em "%s" foi cancelada pelo participante.', v_title),
      'in_app'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_booking_cancel ON public.bookings;
CREATE TRIGGER trg_notify_on_booking_cancel
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status <> 'cancelled')
  EXECUTE FUNCTION public.notify_on_booking_cancel();

-- ------------------------------------------------------------------
-- 3. Instructor approval change -> applicant
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_instructor_approval_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status = OLD.approval_status THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status = 'approved' THEN
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      NEW.user_id,
      'instructor_approved',
      'Aplicação aprovada',
      'Parabéns! Sua aplicação foi aprovada. Agora você pode criar e publicar atividades.',
      'in_app'
    );
  ELSIF NEW.approval_status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      NEW.user_id,
      'instructor_rejected',
      'Aplicação não aprovada',
      CASE
        WHEN NEW.rejection_reason IS NULL OR length(trim(NEW.rejection_reason)) = 0
          THEN 'Sua aplicação não foi aprovada desta vez.'
        ELSE format('Sua aplicação não foi aprovada desta vez. Motivo: %s', NEW.rejection_reason)
      END,
      'in_app'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_instructor_approval_change ON public.instructor_profiles;
CREATE TRIGGER trg_notify_on_instructor_approval_change
  AFTER UPDATE OF approval_status ON public.instructor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_instructor_approval_change();

-- ------------------------------------------------------------------
-- 4. Reorder cancel_activity_with_refunds so the booking cancel
--    trigger's "activity is cancelled" guard fires correctly.
--    Original order: update bookings, then update activity.
--    New order: update activity, then update bookings.
-- ------------------------------------------------------------------
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

  -- Flip activity FIRST so the booking-cancel trigger sees
  -- activity.status='cancelled' and skips its own notification insert.
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

  RETURN v_affected;
END;
$$;
