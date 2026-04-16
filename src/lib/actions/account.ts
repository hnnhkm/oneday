"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateProfileUpdate, type ProfileUpdate } from "@/lib/queries/profile";
import { dispatchEmailsForUsers } from "@/lib/notifications/dispatch-emails";
import { isStripeEnabled } from "@/lib/stripe-config";
import { getStripeClient } from "@/lib/stripe";
import {
  computeRefundCents,
  hoursUntilStartFromTimestamp,
} from "@/lib/refund-policy";
import type { CancellationPolicy } from "@/lib/types/database";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface UploadAvatarResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a profile photo for the current user.
 *
 * Client resizes → posts a JPEG Blob wrapped in FormData → we land
 * it in `avatars/{user_id}/{uuid}.jpg` and return the public URL.
 *
 * The RLS policy on `storage.objects` (see migration 00031) enforces
 * that the first folder segment matches `auth.uid()`, so callers
 * can't write into someone else's folder even if they forged a
 * different path client-side. The caller is responsible for saving
 * the returned URL onto `users.avatar_url` via `updateProfileAction`.
 *
 * We do NOT delete the previous avatar — Supabase storage is cheap
 * and an orphaned file is lower-risk than a broken avatar if the
 * profile update fails after the upload.
 */
export async function uploadAvatarAction(
  formData: FormData
): Promise<UploadAvatarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided" };
  }

  const uuid = crypto.randomUUID();
  const objectPath = `${user.id}/${uuid}.jpg`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (error) return { ok: false, error: error.message };

  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(objectPath);

  return { ok: true, url: urlData.publicUrl };
}

/**
 * Toggle a favorite for the current user. Returns the new state.
 * - If the row exists, delete it → favorited = false
 * - Otherwise insert it → favorited = true
 */
export async function toggleFavoriteAction(
  activityId: string
): Promise<ActionResult & { favorited?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/favorites");
    return { ok: true, favorited: false };
  }

  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, activity_id: activityId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/favorites");
  return { ok: true, favorited: true };
}

/**
 * Update the current user's profile.
 * Validates input server-side before touching the DB.
 */
export async function updateProfileAction(
  update: ProfileUpdate
): Promise<ActionResult> {
  const validationError = validateProfileUpdate(update);
  if (validationError) return { ok: false, error: validationError.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("users")
    .update({
      name: update.name.trim(),
      phone: update.phone || null,
      avatar_url: update.avatar_url || null,
      preferred_language: update.preferred_language,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Cancel a booking. For Phase 3 this is a simple status flip + seat release.
 * TODO (Phase 4): apply cancellation policy window + Stripe refund logic.
 */
export async function cancelBookingAction(
  bookingId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  // Fetch booking + parent activity (cancellation_policy) + session
  // (starts_at for the refund window) in one round-trip. starts_at is
  // a TIMESTAMPTZ so the refund math is timezone-safe, unlike the
  // legacy date+time path.
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select(
      `
      id, user_id, activity_id, session_id, seats_booked, total_price_cents,
      status, stripe_payment_id,
      activities!inner (cancellation_policy),
      activity_sessions!inner (starts_at)
    `
    )
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { ok: false, error: "Booking not found" };
  }

  type Joined = {
    id: string;
    user_id: string;
    activity_id: string;
    session_id: string;
    seats_booked: number;
    total_price_cents: number;
    status: string;
    stripe_payment_id: string | null;
    activities: {
      cancellation_policy: CancellationPolicy;
    };
    activity_sessions: {
      starts_at: string;
    };
  };
  const b = booking as unknown as Joined;

  if (b.user_id !== user.id) {
    return { ok: false, error: "Not authorized" };
  }
  if (b.status !== "confirmed") {
    return { ok: false, error: "Only confirmed bookings can be cancelled" };
  }

  // Apply the cancellation policy. Refund amount is stored on the
  // booking row so we can query later; 0 is a valid outcome (strict
  // policy, cancelled too close to the start time).
  const hours = hoursUntilStartFromTimestamp(b.activity_sessions.starts_at);
  const refundCents = computeRefundCents({
    policy: b.activities.cancellation_policy,
    hoursUntilStart: hours,
    totalPriceCents: b.total_price_cents,
  });

  // Real refund via Stripe for the computed amount (may be 0 → skip).
  // reverse_transfer pulls the money back from the connected account
  // if transfer_data was set on the original Checkout session, and
  // refund_application_fee returns the platform's cut too. Both are
  // no-ops for direct-charge bookings (instructor not connected).
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
      const message = err instanceof Error ? err.message : "refund failed";
      return { ok: false, error: `Refund failed: ${message}` };
    }
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      payment_status: refundCents > 0 ? "refunded" : "paid",
      refund_amount_cents: refundCents,
    })
    .eq("id", bookingId);

  if (updateError) return { ok: false, error: updateError.message };

  // Release seats back to the session — the sole source of truth
  // post-6B (activities.seats_remaining no longer exists).
  const { data: session } = await supabase
    .from("activity_sessions")
    .select("seats_remaining")
    .eq("id", b.session_id)
    .single();

  if (session) {
    await supabase
      .from("activity_sessions")
      .update({ seats_remaining: session.seats_remaining + b.seats_booked })
      .eq("id", b.session_id);
  }

  // Drain emails for booker + instructor (the cancel trigger wrote
  // a row for each).
  const admin = createAdminClient();
  const { data: joined } = await admin
    .from("activities")
    .select("instructor_profiles!inner (user_id)")
    .eq("id", b.activity_id)
    .single();
  const instructorUserId = (
    joined as unknown as {
      instructor_profiles: { user_id: string };
    } | null
  )?.instructor_profiles?.user_id;

  await dispatchEmailsForUsers(
    [user.id, instructorUserId].filter(Boolean) as string[]
  );

  revalidatePath("/bookings");
  return { ok: true };
}
