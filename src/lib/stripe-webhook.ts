/**
 * Pure helpers for the Stripe webhook handler. Extracted into its
 * own module (no server-only imports, no Stripe SDK) so the parser
 * can be unit-tested without standing up an HTTP request or a
 * database.
 *
 * The route handler at /api/stripe/webhook is responsible for:
 *   1. Verifying the signature with Stripe.webhooks.constructEvent
 *   2. Passing the typed event through one of these parsers
 *   3. Translating a `create_booking` action into an RPC call
 *
 * Keeping step 2 pure means we can enumerate every ignore reason in
 * tests without mocking Stripe.
 */

/** Minimal shape of a `checkout.session` we care about. */
export interface CheckoutSessionLike {
  id: string;
  object: "checkout.session";
  payment_status: string;
  metadata: Record<string, string | undefined> | null | undefined;
}

export type CheckoutSessionParseResult =
  | {
      action: "create_booking";
      /** The Stripe Checkout session id (cs_...). */
      sessionId: string;
      /**
       * The activity_sessions.id the booking is for. Required for
       * new in-flight checkouts; missing for legacy in-flight
       * checkouts created before Phase 3 shipped (we ignore those —
       * see `legacy_missing_session` below).
       */
      activitySessionId: string;
      /** The activity template id — still passed through for
       *  audit/logging and back-compat with downstream helpers. */
      activityId: string;
      userId: string;
      seats: number;
    }
  | {
      action: "ignore";
      reason:
        | "payment_not_paid"
        | "missing_metadata"
        | "invalid_seats"
        /** Stripe Checkout session was created before Phase 3 —
         *  metadata has activity_id but no activity_session_id. The
         *  webhook handler refunds and the legacy RPC is no longer
         *  called. This branch only matters during the deploy
         *  window when in-flight checkouts span the switch. */
        | "legacy_missing_session";
    };

/**
 * Translate a `checkout.session.completed` event into an action for
 * the webhook route to execute. Ignores are not errors — Stripe
 * sends completed events in edge cases (abandoned carts that still
 * reach the completed state via testmode tooling, for example) and
 * the route should 200 them without touching the database.
 */
export function parseCheckoutSessionCompleted(
  session: CheckoutSessionLike
): CheckoutSessionParseResult {
  // Only `paid` sessions create bookings. `unpaid` can happen with
  // async payment methods (boleto, Pix in test mode) — those fire a
  // separate `checkout.session.async_payment_succeeded` event which
  // we handle via the same route with `payment_status = 'paid'`.
  if (session.payment_status !== "paid") {
    return { action: "ignore", reason: "payment_not_paid" };
  }

  const meta = session.metadata;
  if (!meta) {
    return { action: "ignore", reason: "missing_metadata" };
  }

  const activityId = meta.activity_id;
  const activitySessionId = meta.activity_session_id;
  const userId = meta.user_id;
  const seatsRaw = meta.seats;

  if (!activityId || !userId || !seatsRaw) {
    return { action: "ignore", reason: "missing_metadata" };
  }

  const seats = Number.parseInt(seatsRaw.trim(), 10);
  if (!Number.isInteger(seats) || seats < 1) {
    return { action: "ignore", reason: "invalid_seats" };
  }

  if (!activitySessionId) {
    // Legacy in-flight checkout from the pre-Phase-3 release. The
    // legacy book_activity_from_webhook RPC still exists but we
    // intentionally don't call it — the handler will surface this
    // as "booking failed" and refund the charge.
    return { action: "ignore", reason: "legacy_missing_session" };
  }

  return {
    action: "create_booking",
    sessionId: session.id,
    activitySessionId,
    activityId,
    userId,
    seats,
  };
}
