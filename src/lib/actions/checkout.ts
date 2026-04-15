"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isStripeEnabled, buildCheckoutLineItems } from "@/lib/stripe-config";
import { getStripeClient } from "@/lib/stripe";
import { createBookingAction } from "@/lib/actions/bookings";
import { computeApplicationFeeCents } from "@/lib/commission";
import { canUserBookActivity } from "@/lib/activity-validation";
import type { ActionResult } from "@/lib/actions/account";
import type { TranslatedField } from "@/lib/types/database";

/** Local structural type for the Connect-specific bits of a
 *  Checkout session. Defined here rather than imported from the
 *  Stripe SDK to sidestep nested-type-path changes across SDK
 *  versions. */
interface PaymentIntentConnectData {
  application_fee_amount: number;
  transfer_data: { destination: string };
}

/**
 * Entry point for the "book now" button. Two modes, switched by
 * `isStripeEnabled()`:
 *
 *   1. Stripe disabled (local dev, no STRIPE_SECRET_KEY):
 *      → delegate to the Phase 4 mocked createBookingAction path.
 *        Returns { ok, bookingId } and the client navigates to the
 *        existing /bookings/{id}/confirmation page.
 *
 *   2. Stripe enabled (production, test keys set):
 *      → Create a Stripe Checkout session. Metadata carries the
 *        activity_id, user_id, seats, and locale so the webhook can
 *        materialize the booking once payment clears. No DB write
 *        happens here; no pending-state rows.
 *
 * The client picks the branch based on whether the return value has
 * a `checkoutUrl` (Stripe flow) or a `bookingId` (mock flow).
 */
export interface CheckoutResult extends ActionResult {
  bookingId?: string;
  checkoutUrl?: string;
}

export async function createCheckoutSessionAction(
  sessionId: string,
  seats: number,
  locale: "pt" | "en" | "es" = "pt"
): Promise<CheckoutResult> {
  if (!Number.isInteger(seats) || seats < 1) {
    return { ok: false, error: "Number of seats must be at least 1" };
  }

  // Mock path: Stripe isn't configured locally. Phase 4 handles the
  // whole book-and-confirm flow without any Stripe involvement.
  if (!isStripeEnabled()) {
    const r = await createBookingAction(sessionId, seats);
    return r;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Pull the session (for seat availability + bookable window) plus
  // its parent activity (for price, title, owner). After the sessions
  // split, seats and time-in-the-future live on the session; price
  // and self-booking ownership remain at the activity template level.
  const { data: session, error: sesErr } = await supabase
    .from("activity_sessions")
    .select(
      `
      id, activity_id, starts_at, ends_at, seats_remaining, status,
      activities!inner (
        id, title, price_cents, cover_image_url, status,
        instructor_profiles!inner (
          user_id, stripe_account_id, commission_rate
        )
      )
    `
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (sesErr || !session) return { ok: false, error: "Session not found" };

  type Row = {
    id: string;
    activity_id: string;
    starts_at: string;
    ends_at: string;
    seats_remaining: number;
    status: string;
    activities: {
      id: string;
      title: TranslatedField;
      price_cents: number;
      cover_image_url: string;
      status: string;
      instructor_profiles: {
        user_id: string;
        stripe_account_id: string | null;
        commission_rate: number;
      };
    };
  };
  const s = session as unknown as Row;
  const a = s.activities;

  // Self-booking guard: instructors can book *other* instructors'
  // activities, but not their own. The RPC also enforces this,
  // but catching it here means we never open a Stripe session we
  // can't use and the user gets a friendly error.
  const bookCheck = canUserBookActivity({
    userId: user.id,
    instructorUserId: a.instructor_profiles?.user_id,
  });
  if (bookCheck?.reason === "own_activity") {
    return { ok: false, error: "cannot book your own activity" };
  }

  // Cheap pre-flight: if seats are already gone, or the session's
  // already started, or either side of the template is unpublished,
  // don't even open a Stripe session. The webhook also re-checks
  // atomically.
  if (a.status !== "published" || s.status !== "published") {
    return { ok: false, error: "Activity is not available" };
  }
  if (new Date(s.starts_at).getTime() <= Date.now()) {
    return { ok: false, error: "Session has already started" };
  }
  if (s.seats_remaining < seats) {
    return { ok: false, error: "Not enough seats remaining" };
  }

  // Build an absolute URL from the incoming request so Stripe can
  // redirect the browser back here regardless of the deploy target.
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const origin =
    process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : "");

  // Line item description uses the *session's* date/time (wall-clock
  // in São Paulo) rather than the activity template's legacy columns,
  // because once multi-session lands the activity row has no single
  // date/time anymore. We format from the TIMESTAMPTZ here.
  const startsAt = new Date(s.starts_at);
  const tzFmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, {
      ...opts,
      timeZone: "America/Sao_Paulo",
    }).format(startsAt);
  const lineItems = buildCheckoutLineItems(
    {
      id: a.id,
      title: a.title,
      price_cents: a.price_cents,
      cover_image_url: a.cover_image_url,
      date: tzFmt({ year: "numeric", month: "2-digit", day: "2-digit" }),
      time: tzFmt({ hour: "2-digit", minute: "2-digit", hour12: false }),
    },
    seats,
    locale
  );

  const stripe = getStripeClient();

  // Connect wiring: when the instructor has completed onboarding
  // and has a stripe_account_id on their profile, route the
  // payment to their connected account via transfer_data and keep
  // the platform cut as application_fee_amount. Without a
  // connected account the session falls back to a direct charge
  // on the platform (mock-money path, works everywhere) and the
  // operator has to reconcile manually.
  const connectedAccountId = a.instructor_profiles?.stripe_account_id;
  const commissionRate = a.instructor_profiles?.commission_rate ?? 0.15;
  const totalCents = a.price_cents * seats;

  const payment_intent_data: PaymentIntentConnectData | undefined =
    connectedAccountId
      ? {
          application_fee_amount: computeApplicationFeeCents(
            totalCents,
            commissionRate
          ),
          transfer_data: {
            destination: connectedAccountId,
          },
        }
      : undefined;

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: `${origin}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${locale}/activities/${a.id}`,
    metadata: {
      // activity_id retained for backwards compatibility with older
      // in-flight Stripe sessions (metadata is immutable once a session
      // is created — we need the webhook parser to accept either shape).
      activity_id: a.id,
      activity_session_id: s.id,
      user_id: user.id,
      seats: seats.toString(),
      locale,
    },
    ...(payment_intent_data ? { payment_intent_data } : {}),
  });

  if (!stripeSession.url) {
    return { ok: false, error: "Could not create Stripe Checkout session" };
  }
  return { ok: true, checkoutUrl: stripeSession.url };
}
