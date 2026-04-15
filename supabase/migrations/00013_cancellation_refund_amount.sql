-- ============================================================
-- Phase 11: record the actual refund amount on a cancelled booking.
--
-- Prior to this, cancel flows flipped payment_status='refunded' as
-- a flat flag, which was fine when everything was 100% refundable.
-- With real policy enforcement a booking can be 0%, 50%, or 100%
-- refunded, and we need to remember which.
--
-- The column defaults to 0 so existing rows read as "nothing
-- refunded" until they're actually cancelled and the cancel
-- action populates it.
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_amount_cents INTEGER NOT NULL DEFAULT 0
    CHECK (refund_amount_cents >= 0);
