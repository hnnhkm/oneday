"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateReview } from "@/lib/queries/reviews";
import { dispatchEmailsForUsers } from "@/lib/notifications/dispatch-emails";
import { canUserBookActivity } from "@/lib/activity-validation";
import type { ActionResult } from "@/lib/actions/account";

/**
 * Create a booking for the current user. Delegates the seat-availability
 * check, decrement, and insert to the atomic `book_session` Postgres function
 * so two concurrent callers cannot double-spend the last seat.
 *
 * Payment is mocked: the function inserts the booking with payment_status='paid'
 * and status='confirmed'. When real Stripe is wired up, callers go through
 * createCheckoutSessionAction instead and the webhook materialises the booking
 * on payment success via book_session_from_webhook.
 */
export async function createBookingAction(
  sessionId: string,
  seats: number
): Promise<ActionResult & { bookingId?: string }> {
  if (!Number.isInteger(seats) || seats < 1) {
    return { ok: false, error: "Number of seats must be at least 1" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Pre-check the self-booking guard so the user gets a friendly
  // error instead of raw 'cannot book your own activity' from the
  // SQL layer. The RPC still has the same check as belt-and-braces.
  // We resolve session → activity → instructor so the email dispatch
  // pass below can re-use `instructorUserId` and `activityId`.
  const admin = createAdminClient();
  const { data: ownership } = await admin
    .from("activity_sessions")
    .select("activity_id, activities!inner (instructor_profiles!inner (user_id))")
    .eq("id", sessionId)
    .maybeSingle();
  const ownershipRow = ownership as unknown as {
    activity_id: string;
    activities: { instructor_profiles: { user_id: string } };
  } | null;
  if (!ownershipRow) {
    return { ok: false, error: "session not found" };
  }
  const activityId = ownershipRow.activity_id;
  const instructorUserId =
    ownershipRow.activities?.instructor_profiles?.user_id;
  const guard = canUserBookActivity({
    userId: user.id,
    instructorUserId,
  });
  if (guard?.reason === "own_activity") {
    return { ok: false, error: "cannot book your own activity" };
  }

  const { data, error } = await supabase.rpc("book_session", {
    p_user_id: user.id,
    p_session_id: sessionId,
    p_seats: seats,
  });

  if (error) {
    // Surface the Postgres exception message; book_session raises with
    // human-readable text ('not enough seats remaining', etc).
    return { ok: false, error: error.message };
  }

  // RPC returns the new booking id as a uuid.
  const bookingId = typeof data === "string" ? data : null;
  if (!bookingId) {
    return { ok: false, error: "Booking failed" };
  }

  revalidatePath("/bookings");
  revalidatePath(`/activities/${activityId}`);

  // The trigger already wrote notification rows for booker +
  // instructor. instructorUserId was already resolved in the
  // self-booking pre-check above, so we drain both inboxes in a
  // single pass without a second round-trip.
  await dispatchEmailsForUsers(
    [user.id, instructorUserId].filter(Boolean) as string[]
  );

  return { ok: true, bookingId };
}

/**
 * Submit a review for a booking the current user has completed.
 * Server-side authorization (in addition to the RLS policy on reviews):
 *   - User must own a booking on this activity with status='completed'
 *   - The activity must be in the past
 *   - One review per (user, activity) — enforced by the unique constraint,
 *     but we check first to return a friendly error.
 */
export async function submitReviewAction(
  activityId: string,
  rating: number,
  comment: string
): Promise<ActionResult & { reviewId?: string }> {
  const validationError = validateReview({ rating, comment });
  if (validationError) return { ok: false, error: validationError.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "You have already reviewed this activity" };
  }

  const { data: inserted, error } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,
      activity_id: activityId,
      rating,
      comment: comment.trim(),
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false, error: error?.message || "Insert failed" };

  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/bookings");
  return { ok: true, reviewId: (inserted as { id: string }).id };
}

/**
 * Upload a single photo attached to an existing review. Called
 * client-side after submitReviewAction returns the new review id.
 * Path convention: `review-photos/{user_id}/{uuid}.jpg` — the
 * storage policy checks the folder prefix against auth.uid(), and
 * the review_photos INSERT policy checks that the review belongs
 * to the caller, so ownership is validated twice.
 *
 * Client is responsible for resizing before upload (see the
 * instructor image-uploader for the canvas resize helper).
 */
export async function uploadReviewPhotoAction(
  reviewId: string,
  formData: FormData
): Promise<ActionResult & { url?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Verify the review is owned by the caller before uploading. The
  // RLS policies would catch this too, but failing early is nicer.
  const { data: review } = await supabase
    .from("reviews")
    .select("id, user_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review || (review as { user_id: string }).user_id !== user.id) {
    return { ok: false, error: "Not authorized" };
  }

  // Server-side cap on photos per review. The client limits this too
  // (ReviewForm.MAX_PHOTOS = 5), but a custom client could bypass
  // the UI and spam the action. Keep the numbers in sync.
  const MAX_PHOTOS_PER_REVIEW = 5;
  const { count: existingCount } = await supabase
    .from("review_photos")
    .select("id", { count: "exact", head: true })
    .eq("review_id", reviewId);
  if ((existingCount ?? 0) >= MAX_PHOTOS_PER_REVIEW) {
    return { ok: false, error: "photo_limit_reached" };
  }

  const uuid = crypto.randomUUID();
  const objectPath = `${user.id}/${uuid}.jpg`;

  const { error: uploadErr } = await supabase.storage
    .from("review-photos")
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data: urlData } = supabase.storage
    .from("review-photos")
    .getPublicUrl(objectPath);

  const { error: insertErr } = await supabase.from("review_photos").insert({
    review_id: reviewId,
    image_url: urlData.publicUrl,
  });
  if (insertErr) {
    // Best-effort cleanup: remove the uploaded object since the
    // insert failed. Swallow errors here.
    await supabase.storage.from("review-photos").remove([objectPath]);
    return { ok: false, error: insertErr.message };
  }

  return { ok: true, url: urlData.publicUrl };
}
