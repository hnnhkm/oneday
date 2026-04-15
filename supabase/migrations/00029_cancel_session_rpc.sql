-- ============================================================
-- Phase 12: cancel_session_with_refunds
--
-- Per-session analog of cancel_activity_with_refunds (00005).
-- Single code path for cancelling a session — called by both
-- the instructor dashboard's "Cancelar" button AND the hourly
-- cron's expire function. Shared path = identical behavior
-- regardless of trigger, and regression risk has one home.
--
-- Refund amount is always 100% of what the participant paid,
-- because this path only runs for system-initiated cancels
-- (quorum not met) or instructor-initiated cancels that are
-- independent of the participant. The cancellation policy
-- (flexible/moderate/strict) only applies to PARTICIPANT-
-- initiated cancels, which flow through cancelBookingAction
-- (not this RPC).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cancel_session_with_refunds(
  p_session_id UUID,
  p_reason     TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid          UUID := auth.uid();
  v_instructor_profile  UUID;
  v_session             RECORD;
  v_title               TEXT;
  v_starts_at           TIMESTAMPTZ;
  v_affected            INT := 0;
  v_booking             RECORD;
  v_body                TEXT;
BEGIN
  -- ------------------------------------------------------------
  -- Load the session + parent activity in one shot.
  -- ------------------------------------------------------------
  SELECT
    s.id, s.activity_id, s.starts_at, s.status,
    a.instructor_id,
    COALESCE(a.title->>'pt', 'atividade') AS title_pt
  INTO v_session
  FROM public.activity_sessions s
  JOIN public.activities a ON a.id = s.activity_id
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status = 'cancelled' THEN
    RAISE EXCEPTION 'session_already_cancelled' USING ERRCODE = 'P0001';
  END IF;

  IF v_session.starts_at < now() THEN
    RAISE EXCEPTION 'session_already_started' USING ERRCODE = 'P0001';
  END IF;

  -- ------------------------------------------------------------
  -- Authz: either the instructor owns the activity, OR the caller
  -- has no auth.uid() at all (service-role / admin client from the
  -- cron). The cron invokes with the service-role key and
  -- auth.uid() is NULL in that case, so we let it pass.
  -- ------------------------------------------------------------
  IF v_caller_uid IS NOT NULL THEN
    SELECT ip.id INTO v_instructor_profile
    FROM public.instructor_profiles ip
    WHERE ip.user_id = v_caller_uid
      AND ip.approval_status = 'approved';

    IF v_instructor_profile IS NULL
       OR v_instructor_profile <> v_session.instructor_id THEN
      RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ------------------------------------------------------------
  -- Flip the session. Both status and quorum_state.
  -- ------------------------------------------------------------
  UPDATE public.activity_sessions
  SET status = 'cancelled',
      quorum_state = 'cancelled',
      updated_at = now()
  WHERE id = p_session_id;

  -- ------------------------------------------------------------
  -- Refund every non-cancelled booking on this session. Full amount.
  -- ------------------------------------------------------------
  FOR v_booking IN
    SELECT id, user_id, total_price_cents
    FROM public.bookings
    WHERE session_id = p_session_id
      AND status <> 'cancelled'
  LOOP
    UPDATE public.bookings
    SET status = 'cancelled',
        payment_status = 'refunded',
        refund_amount_cents = total_price_cents,
        cancelled_at = now()
    WHERE id = v_booking.id;

    v_body := CASE p_reason
      WHEN 'quorum_not_met' THEN
        format(
          'A sessão de "%s" foi cancelada porque não atingiu o mínimo de participantes. Seu pagamento foi reembolsado integralmente.',
          v_session.title_pt
        )
      ELSE
        format(
          'A sessão de "%s" foi cancelada pelo instrutor. Seu pagamento foi reembolsado integralmente.',
          v_session.title_pt
        )
    END;

    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      v_booking.user_id,
      'booking_cancelled',
      'Sessão cancelada',
      v_body,
      'in_app'
    );

    v_affected := v_affected + 1;
  END LOOP;

  RETURN v_affected;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_session_with_refunds(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_session_with_refunds(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_session_with_refunds(UUID, TEXT) TO service_role;

COMMIT;
