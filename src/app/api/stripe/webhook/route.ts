import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isStripeEnabled } from "@/lib/stripe-config";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEmailsForUsers } from "@/lib/notifications/dispatch-emails";
import {
  parseCheckoutSessionCompleted,
  type CheckoutSessionLike,
} from "@/lib/stripe-webhook";

/**
 * Stripe Checkout webhook.
 *
 * Handles `checkout.session.completed`: atomically creates the real
 * booking via `book_activity_from_webhook` RPC (service-role admin
 * client, bypassing the user-session RLS so we can insert on behalf
 * of the buyer). The RPC is idempotent — if Stripe retries the
 * delivery, we return the existing booking id instead of double-
 * spending a seat.
 *
 * If the RPC fails because seats sold out between session creation
 * and webhook delivery, we refund the payment immediately via Stripe
 * so the buyer isn't left holding a charge for a booking that never
 * existed.
 *
 * Signature verification uses STRIPE_WEBHOOK_SECRET. A request
 * without a valid signature gets 400 — that's a security boundary,
 * not a dev convenience toggle.
 *
 * Local dev: Stripe CLI can forward live events with
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 * Without a real key + webhook secret this route is dormant.
 */

// Next.js by default will try to parse the request body as JSON for
// POST handlers in api routes. We need the raw body for signature
// verification, so force the dynamic route and read the body ourselves.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isStripeEnabled()) {
    // Stripe isn't configured; the webhook shouldn't be receiving
    // real events. Return 404 rather than 500 so misconfigured
    // deployments look "route not found" in dashboards.
    return new NextResponse("Not found", { status: 404 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", {
      status: 400,
    });
  }

  const rawBody = await req.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return new NextResponse(`Signature verification failed: ${message}`, {
      status: 400,
    });
  }

  // `checkout.session.async_payment_succeeded` is the Pix/boleto
  // companion event — same shape as `checkout.session.completed` but
  // fires after the async payment clears. We treat both the same way
  // because the parser only acts on `payment_status === 'paid'`.
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    // Silently accept other event types — Stripe retries 5xx, and we
    // don't want to spam the dashboard with 200s that did nothing.
    return new NextResponse("ignored", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const parsed = parseCheckoutSessionCompleted(
    session as unknown as CheckoutSessionLike
  );

  if (parsed.action === "ignore") {
    // Return 200 so Stripe doesn't retry — these aren't errors, the
    // event just doesn't map to a booking we want to materialize.
    return new NextResponse(`ignored: ${parsed.reason}`, { status: 200 });
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const admin = createAdminClient();

  const { data: bookingId, error: bookErr } = await admin.rpc(
    "book_session_from_webhook",
    {
      p_user_id: parsed.userId,
      p_session_id: parsed.activitySessionId,
      p_seats: parsed.seats,
      p_stripe_session_id: parsed.sessionId,
    }
  );

  if (bookErr || typeof bookingId !== "string") {
    // Race lost: seats gone between session creation and webhook,
    // or some other unexpected SQL failure. Refund the buyer so we
    // don't hold their money. If the refund also fails we return 500
    // so Stripe will retry the webhook.
    if (paymentIntent) {
      try {
        await stripe.refunds.create({
          payment_intent: paymentIntent,
          reverse_transfer: true,
          refund_application_fee: true,
        });
      } catch (refundErr) {
        console.error("[stripe:webhook] refund failed", refundErr);
        return new NextResponse("booking failed, refund failed", {
          status: 500,
        });
      }
    }
    return new NextResponse(
      `booking failed: ${bookErr?.message || "no booking id"}`,
      { status: 200 }
    );
  }

  // Stamp the booking with the payment intent id so the cancel
  // flow can initiate a refund later. stripe_session_id was
  // already written by the RPC.
  if (paymentIntent) {
    await admin
      .from("bookings")
      .update({ stripe_payment_id: paymentIntent })
      .eq("id", bookingId);
  }

  // Drain any notification emails the triggers just wrote. This is
  // best-effort — if it throws, the booking is still materialized
  // and the daily cron will pick up unsent emails on its next pass.
  try {
    await dispatchEmailsForUsers([parsed.userId]);
  } catch (err) {
    console.error("[stripe:webhook] email dispatch failed", err);
  }

  return new NextResponse("ok", { status: 200 });
}
