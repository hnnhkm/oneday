-- Phase 8: Stripe Checkout integration
--
-- The webhook flow creates a booking in response to
-- checkout.session.completed. We need to look up that booking from
-- the /checkout/success page (the user lands here with ?session_id=
-- in the URL) so we can redirect them to the real confirmation page.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_stripe_session
  ON public.bookings(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
