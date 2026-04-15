"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEmailsForUsers } from "@/lib/notifications/dispatch-emails";
import { isStripeEnabled } from "@/lib/stripe-config";
import { getStripeClient } from "@/lib/stripe";
import { toSpTimestamptz } from "@/lib/queries/session-synthesis";
import type { ActivitySession } from "@/lib/types/database";

export interface SessionActionResult {
  ok: boolean;
  error?: string;
  /**
   * Stable error reason that the UI can branch on without parsing
   * localized strings. `error` carries the English fallback for
   * logging / unexpected cases.
   */
  reason?:
    | "not_authenticated"
    | "not_authorized"
    | "activity_not_found"
    | "session_not_found"
    | "has_bookings"
    | "invalid_date"
    | "invalid_time"
    | "invalid_seats"
    | "in_the_past"
    | "conflict_with_existing_session"
    | "unexpected";
}

async function requireProfileId(): Promise<
  | { ok: true; profileId: string; userId: string }
  | { ok: false; reason: "not_authenticated" | "not_authorized" }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_authenticated" };

  const { data: profile } = await supabase
    .from("instructor_profiles")
    .select("id, approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.approval_status !== "approved") {
    return { ok: false, reason: "not_authorized" };
  }
  return {
    ok: true,
    profileId: profile.id as string,
    userId: user.id,
  };
}

export interface AddSessionInput {
  date: string; // YYYY-MM-DD (São Paulo wall-clock)
  time: string; // HH:MM (São Paulo wall-clock)
  max_seats: number;
}

/**
 * Add a new session to an existing activity.
 *
 * The activity template provides `duration_minutes`; `ends_at` is
 * derived so the instructor only picks a start time. The EXCLUDE
 * constraint from 00020 prevents two sessions from overlapping on the
 * same activity — we surface that as `conflict_with_existing_session`.
 */
export async function addActivitySessionAction(
  activityId: string,
  input: AddSessionInput
): Promise<SessionActionResult & { sessionId?: string }> {
  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, reason: auth.reason };

  // Basic shape validation before round-tripping the DB.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || "")) {
    return { ok: false, reason: "invalid_date", error: "Invalid date" };
  }
  if (!/^\d{2}:\d{2}$/.test(input.time || "")) {
    return { ok: false, reason: "invalid_time", error: "Invalid time" };
  }
  if (
    !Number.isInteger(input.max_seats) ||
    input.max_seats < 1 ||
    input.max_seats > 1000
  ) {
    return { ok: false, reason: "invalid_seats", error: "Invalid seats" };
  }

  const startsAtIso = toSpTimestamptz(input.date, input.time);
  if (new Date(startsAtIso).getTime() <= Date.now()) {
    return { ok: false, reason: "in_the_past", error: "Start time is in the past" };
  }

  const supabase = await createClient();

  // Pull the activity's duration (authoritative) + confirm ownership.
  const { data: activity } = await supabase
    .from("activities")
    .select("id, duration_minutes")
    .eq("id", activityId)
    .eq("instructor_id", auth.profileId)
    .maybeSingle();

  if (!activity) {
    return { ok: false, reason: "activity_not_found", error: "Activity not found" };
  }

  const endsAt = new Date(
    new Date(startsAtIso).getTime() +
      (activity as { duration_minutes: number }).duration_minutes * 60_000
  ).toISOString();

  const { data: inserted, error } = await supabase
    .from("activity_sessions")
    .insert({
      activity_id: activityId,
      starts_at: startsAtIso,
      ends_at: endsAt,
      max_seats: input.max_seats,
      seats_remaining: input.max_seats,
      status: "published",
    })
    .select("id")
    .single();

  if (error) {
    // Postgres exclusion-constraint violations come back as 23P01.
    // Surface a clean reason so the UI can render a friendly message
    // instead of the raw "conflicting key value violates exclusion…".
    if (error.code === "23P01") {
      return {
        ok: false,
        reason: "conflict_with_existing_session",
        error: "A session at that time already exists",
      };
    }
    return { ok: false, reason: "unexpected", error: error.message };
  }

  revalidatePath(`/instructor/activities/${activityId}`);
  revalidatePath(`/activities/${activityId}`);
  return { ok: true, sessionId: (inserted as { id: string }).id };
}

/**
 * Cancel a session. Flips status to 'cancelled' and cancels every
 * confirmed booking attached to it, issuing refunds per the activity's
 * cancellation policy. Mirrors `cancelActivityAction` but scoped to a
 * single session.
 *
 * We deliberately don't wrap this in a stored procedure — the real
 * refund work happens outside Postgres (Stripe) and the ordering we
 * want is: DB state first → Stripe best-effort → notifications. That's
 * easier to reason about in TS.
 */
export async function cancelActivitySessionAction(
  sessionId: string,
  reason?: string
): Promise<SessionActionResult & { affectedBookings?: number }> {
  // Reason is accepted for future notification wiring (e.g. "venue
  // flooded", "instructor illness"). Today the booking_cancelled
  // notification trigger has no reason column, so we accept-and-ignore
  // rather than block callers on schema work.
  void reason;

  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, reason: auth.reason };

  const supabase = await createClient();

  // Fetch session + parent activity for the ownership check. Joining
  // through instructor_profile_id makes this authoritative — RLS is
  // belt-and-braces.
  const { data: row } = await supabase
    .from("activity_sessions")
    .select(
      `
      id, activity_id, starts_at, status,
      activities!inner ( id, instructor_id )
    `
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!row) {
    return { ok: false, reason: "session_not_found", error: "Session not found" };
  }

  type Joined = {
    id: string;
    activity_id: string;
    starts_at: string;
    status: string;
    activities: {
      id: string;
      instructor_id: string;
    };
  };
  const s = row as unknown as Joined;

  if (s.activities.instructor_id !== auth.profileId) {
    return { ok: false, reason: "not_authorized", error: "Not authorized" };
  }

  // Already cancelled/completed — treat as a no-op success so double
  // clicks don't surface as errors.
  if (s.status === "cancelled" || s.status === "completed") {
    return { ok: true, affectedBookings: 0 };
  }

  // Snapshot active bookings BEFORE we flip status so we know exactly
  // what to refund + email. Admin client because the caller can't
  // SELECT other users' bookings via RLS.
  const admin = createAdminClient();
  const { data: bookingsBefore } = await admin
    .from("bookings")
    .select(
      "id, user_id, stripe_payment_id, total_price_cents, status"
    )
    .eq("session_id", sessionId)
    .neq("status", "cancelled");

  type BookingSnap = {
    id: string;
    user_id: string;
    stripe_payment_id: string | null;
    total_price_cents: number;
    status: string;
  };
  const bookings = (bookingsBefore as BookingSnap[]) || [];

  // When the instructor cancels, bookers get a full refund regardless
  // of policy — the policy governs *user-initiated* cancellations.
  // Flip the session first via admin client to keep the whole batch
  // of writes under one privilege level.
  const { error: updateSessionError } = await admin
    .from("activity_sessions")
    .update({
      status: "cancelled",
    })
    .eq("id", sessionId);

  if (updateSessionError) {
    return {
      ok: false,
      reason: "unexpected",
      error: updateSessionError.message,
    };
  }

  // Cancel each booking + stamp refund amounts. Ideally this would be
  // a single UPDATE with a CASE but booking rows need per-row refund
  // values only if we start using policy (today they're all full).
  for (const b of bookings) {
    const refundCents = b.total_price_cents;

    if (isStripeEnabled() && b.stripe_payment_id && refundCents > 0) {
      try {
        const stripe = getStripeClient();
        await stripe.refunds.create({
          payment_intent: b.stripe_payment_id,
          amount: refundCents,
          reverse_transfer: true,
          refund_application_fee: true,
        });
      } catch (err) {
        // Log but don't fail the whole cancellation — the DB flip is
        // the user-visible truth and a reconciliation job can retry
        // later. Matches cancelActivityAction's philosophy.
        console.error(
          "[stripe:refund] failed for payment_intent",
          b.stripe_payment_id,
          err
        );
      }
    }

    await admin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        payment_status: refundCents > 0 ? "refunded" : "paid",
        refund_amount_cents: refundCents,
      })
      .eq("id", b.id);
  }

  // Drain booker inboxes (the booking_cancelled notification trigger
  // fires when status flips to cancelled).
  const affectedUserIds = Array.from(new Set(bookings.map((b) => b.user_id)));
  await dispatchEmailsForUsers(affectedUserIds);

  revalidatePath(`/instructor/activities/${s.activity_id}`);
  revalidatePath(`/activities/${s.activity_id}`);
  revalidatePath("/bookings");
  return { ok: true, affectedBookings: bookings.length };
}

/**
 * Hard-delete a session. Only allowed when no bookings reference it —
 * the FK (`bookings.session_id … ON DELETE RESTRICT`) would reject it
 * anyway, but surfacing `has_bookings` up front means the UI can tell
 * the instructor "cancel it instead" without trying the delete.
 */
export async function deleteActivitySessionAction(
  sessionId: string
): Promise<
  SessionActionResult & {
    bookingCount?: number;
  }
> {
  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, reason: auth.reason };

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("activity_sessions")
    .select(
      `
      id, activity_id,
      activities!inner ( id, instructor_id )
    `
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!row) {
    return {
      ok: false,
      reason: "session_not_found",
      error: "Session not found",
    };
  }

  type Joined = {
    id: string;
    activity_id: string;
    activities: { id: string; instructor_id: string };
  };
  const s = row as unknown as Joined;

  if (s.activities.instructor_id !== auth.profileId) {
    return { ok: false, reason: "not_authorized", error: "Not authorized" };
  }

  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if ((count || 0) > 0) {
    return {
      ok: false,
      reason: "has_bookings",
      bookingCount: count || 0,
      error: "Cannot delete: session has bookings",
    };
  }

  // Keep at least one session on every activity. Post-6B there's no
  // mirror trigger enforcing this, but `pickBookableSession` still
  // returns null for an activity with zero sessions, which would
  // permanently hide the activity from the marketplace / detail page.
  // Instructors should cancel the activity outright if they want it
  // gone.
  const { data: siblings } = await supabase
    .from("activity_sessions")
    .select("id")
    .eq("activity_id", s.activity_id);
  if ((siblings as ActivitySession[] | null)?.length === 1) {
    return {
      ok: false,
      reason: "not_authorized",
      error:
        "Cannot delete the only session — cancel the activity instead",
    };
  }

  const { error } = await supabase
    .from("activity_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    return { ok: false, reason: "unexpected", error: error.message };
  }

  revalidatePath(`/instructor/activities/${s.activity_id}`);
  revalidatePath(`/activities/${s.activity_id}`);
  return { ok: true };
}

/**
 * Instructor override: confirm an at-risk session so it will run
 * even though quorum isn't met. Server-side wrapper around the
 * confirm_session_quorum RPC — the RPC enforces ownership.
 */
export async function confirmSessionQuorumAction(
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_session_quorum", {
    p_session_id: sessionId,
  });
  if (error) {
    // Normalize common failure modes so the UI can toast them.
    if (error.message.includes("already_confirmed")) {
      return { ok: false, error: "already_confirmed" };
    }
    if (error.message.includes("already_cancelled")) {
      return { ok: false, error: "already_cancelled" };
    }
    if (error.message.includes("not_at_risk")) {
      return { ok: false, error: "not_at_risk" };
    }
    if (error.message.includes("not_authorized")) {
      return { ok: false, error: "not_authorized" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Instructor-initiated cancel of a single session. Reason is
 * 'instructor_cancelled' by default — quorum auto-cancel uses a
 * different reason and calls the RPC directly from the cron.
 */
export async function cancelSessionAction(
  sessionId: string
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_session_with_refunds", {
    p_session_id: sessionId,
    p_reason: "instructor_cancelled",
  });
  if (error) {
    if (error.message.includes("session_already_cancelled")) {
      return { ok: false, error: "already_cancelled" };
    }
    if (error.message.includes("not_authorized")) {
      return { ok: false, error: "not_authorized" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, affected: (data as number) ?? 0 };
}
