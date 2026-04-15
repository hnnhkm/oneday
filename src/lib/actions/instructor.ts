"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEmailsForUsers } from "@/lib/notifications/dispatch-emails";
import {
  validateActivityInput,
  canPublishActivity,
  canDeleteActivity,
  canCancelActivity,
  type ActivityInput,
  type ActivityValidationField,
} from "@/lib/queries/activities";
import { geocodeAddress } from "@/lib/geocoding";
import { fetchBookingCountForActivity } from "@/lib/queries/instructor";
import { canMarkNoShow } from "@/lib/queries/bookings";
import { formatCurrency } from "@/lib/utils";
import { isStripeEnabled } from "@/lib/stripe-config";
import { getStripeClient } from "@/lib/stripe";
import {
  pickPrimarySession,
  toSpTimestamptz,
  type SessionLike,
} from "@/lib/queries/session-synthesis";
import type { SocialLinks, TranslatedField } from "@/lib/types/database";

export interface InstructorActionResult {
  ok: boolean;
  error?: string;
  field?: ActivityValidationField;
}

// ------------------------------------------------------------------
// apply
// ------------------------------------------------------------------

export interface InstructorApplicationInput {
  bio: string;
  specialties: string[];
  social_links: SocialLinks;
  id_document_url?: string | null;
}

export async function applyToBeInstructorAction(
  input: InstructorApplicationInput
): Promise<InstructorActionResult> {
  const bio = (input.bio || "").trim();
  if (bio.length < 50 || bio.length > 1000) {
    return {
      ok: false,
      error: "Bio must be between 50 and 1000 characters",
    };
  }
  const specialties = (input.specialties || [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (specialties.length < 1 || specialties.length > 10) {
    return { ok: false, error: "Pick 1 to 10 specialties" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("instructor_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "already_applied" };
  }

  const { error } = await supabase.from("instructor_profiles").insert({
    user_id: user.id,
    bio,
    specialties,
    social_links: input.social_links || {},
    id_document_url: input.id_document_url?.trim() || null,
    approval_status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/instructor", "layout");
  return { ok: true };
}

/**
 * Edit an already-approved instructor profile. Same shape as the
 * application input (minus the "must not already exist" guard).
 * Used by /instructor/profile to let approved instructors keep
 * their bio, specialties, social links, and ID document up to
 * date after their application has been accepted.
 */
export interface InstructorProfileUpdate {
  bio: string;
  specialties: string[];
  social_links: SocialLinks;
  id_document_url?: string | null;
}

export async function updateInstructorProfileAction(
  input: InstructorProfileUpdate
): Promise<InstructorActionResult> {
  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bio = (input.bio || "").trim();
  if (bio.length < 50 || bio.length > 1000) {
    return {
      ok: false,
      error: "Bio must be between 50 and 1000 characters",
    };
  }
  const specialties = (input.specialties || [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (specialties.length < 1 || specialties.length > 10) {
    return { ok: false, error: "Pick 1 to 10 specialties" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("instructor_profiles")
    .update({
      bio,
      specialties,
      social_links: input.social_links || {},
      id_document_url:
        input.id_document_url === undefined
          ? undefined
          : input.id_document_url?.trim() || null,
    })
    .eq("id", auth.profileId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/instructor/profile");
  revalidatePath("/instructor", "layout");
  // Also revalidate the public profile page since the instructor's
  // bio shows there.
  revalidatePath(`/instructors/${auth.profileId}`);
  return { ok: true };
}

/**
 * Upload an ID document for the application flow. Runs BEFORE the
 * instructor_profiles row exists (the applicant might not have a
 * profile yet), so we key the storage path off the auth user id
 * rather than the profile id. The URL is later stored on the
 * profile row via applyToBeInstructorAction's id_document_url
 * param.
 */
export async function uploadIdDocumentAction(
  formData: FormData
): Promise<UploadImageResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const ext = file.type.includes("pdf") ? "pdf" : "jpg";
  const uuid = crypto.randomUUID();
  const objectPath = `${user.id}/${uuid}.${ext}`;

  const { error } = await supabase.storage
    .from("id-documents")
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (error) return { ok: false, error: error.message };

  const { data: urlData } = supabase.storage
    .from("id-documents")
    .getPublicUrl(objectPath);

  return { ok: true, url: urlData.publicUrl };
}

// ------------------------------------------------------------------
// activity CRUD
// ------------------------------------------------------------------

async function requireProfileId(): Promise<
  { ok: true; profileId: string; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("instructor_profiles")
    .select("id, approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return { ok: false, error: "No instructor profile" };
  if (profile.approval_status !== "approved") {
    return { ok: false, error: "Application not approved" };
  }
  return { ok: true, profileId: profile.id as string, userId: user.id };
}

/**
 * Build the row-shape we INSERT/UPDATE on `activities`. Phase 6B: the
 * per-date/per-seat fields (`date`, `time`, `max_seats`,
 * `seats_remaining`) no longer live on the activity — they belong to
 * `activity_sessions`. The parent activity is now a pure "template":
 * title, description, category, address, images, policy. Every caller
 * that used to stamp those four fields here now inserts/updates
 * `activity_sessions` rows separately.
 */
function toActivityRow(
  input: ActivityInput,
  geocoded: { lat: number; lng: number },
  instructor_id: string,
  status: "draft" | "published"
) {
  return {
    instructor_id,
    title: input.title,
    description: input.description,
    category_id: input.category_id,
    tags: input.tags || [],
    price_cents: input.price_cents,
    duration_minutes: input.duration_minutes,
    address: input.address,
    neighborhood: input.neighborhood,
    city: input.city,
    state: input.state,
    latitude: geocoded.lat,
    longitude: geocoded.lng,
    cover_image_url: input.cover_image_url,
    gallery_image_urls: input.gallery_image_urls || [],
    cancellation_policy: input.cancellation_policy,
    cancellation_policy_text: input.cancellation_policy_text,
    no_show_fee_cents: input.no_show_fee_cents,
    min_participants: input.min_participants,
    status,
  };
}

/**
 * Derive `ends_at` from a start TIMESTAMPTZ + duration minutes. Kept
 * here rather than inlined so create/duplicate/publish all compute
 * session bounds the same way.
 */
function sessionEndsAtIso(
  startsAtIso: string,
  durationMinutes: number
): string {
  return new Date(
    new Date(startsAtIso).getTime() + durationMinutes * 60_000
  ).toISOString();
}

export async function createActivityAction(
  input: ActivityInput
): Promise<InstructorActionResult & { activityId?: string }> {
  const err = validateActivityInput(input);
  if (err) return { ok: false, error: err.message, field: err.field };

  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, error: auth.error };

  // Prefer user-picked coordinates from the map over a forward
  // geocode — the explicit pin is authoritative. Fall back to
  // geocoding the address text if no pin was set, and to 0/0 if
  // geocoding also fails (drafts are still savable then).
  const geocoded =
    input.latitude != null && input.longitude != null
      ? { lat: input.latitude, lng: input.longitude }
      : (await geocodeAddress(
          input.address,
          input.city,
          input.state
        )) || { lat: 0, lng: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .insert(toActivityRow(input, geocoded, auth.profileId, "draft"))
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const activityId = (data as { id: string }).id;

  // Phase 6B: the activity shell is inserted; now create the first
  // session from the form's date/time/max_seats. The `activities` row
  // no longer carries those fields, so without this we'd leave a
  // session-less activity that `pickBookableSession` would treat as
  // unlisted.
  const startsAtIso = toSpTimestamptz(input.date, input.time);
  const endsAtIso = sessionEndsAtIso(startsAtIso, input.duration_minutes);
  const { error: sessionError } = await supabase
    .from("activity_sessions")
    .insert({
      activity_id: activityId,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      max_seats: input.max_seats,
      seats_remaining: input.max_seats,
      // Mirror the activity's draft status — the session becomes
      // publish-visible only once the instructor publishes the
      // activity via publishActivityAction, which flips draft
      // sessions alongside the activity.
      status: "draft",
    });

  if (sessionError) {
    // Best-effort rollback: without a session the activity is
    // unusable (pickBookableSession returns null, listing pages
    // filter it out). Easier to drop it now than leave orphaned
    // shells around.
    await supabase.from("activities").delete().eq("id", activityId);
    return { ok: false, error: sessionError.message };
  }

  revalidatePath("/instructor/activities");
  return { ok: true, activityId };
}

export async function updateActivityAction(
  activityId: string,
  input: ActivityInput
): Promise<InstructorActionResult> {
  const err = validateActivityInput(input);
  if (err) return { ok: false, error: err.message, field: err.field };

  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("activities")
    .select("id, address, city, state, latitude, longitude, status")
    .eq("id", activityId)
    .eq("instructor_id", auth.profileId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Activity not found" };

  type Existing = {
    address: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
  };
  const e = existing as Existing;

  const addressChanged =
    e.address !== input.address ||
    e.city !== input.city ||
    e.state !== input.state;

  // Prefer a user-picked pin over forward geocoding, same as
  // createActivityAction. If the user didn't pick and the address
  // text changed, re-geocode; otherwise keep the existing coords.
  let geocoded: { lat: number; lng: number };
  if (input.latitude != null && input.longitude != null) {
    geocoded = { lat: input.latitude, lng: input.longitude };
  } else if (addressChanged) {
    geocoded =
      (await geocodeAddress(input.address, input.city, input.state)) || {
        lat: e.latitude,
        lng: e.longitude,
      };
  } else {
    geocoded = { lat: e.latitude, lng: e.longitude };
  }

  // Phase 6B: max_seats/seats_remaining/date/time now live on
  // activity_sessions. The edit form hides those fields — callers
  // change them via the sessions-manager panel, which updates sessions
  // directly. We only touch the template fields here.
  const row = toActivityRow(
    input,
    geocoded,
    auth.profileId,
    "draft" // status is flipped separately via publishActivityAction
  );
  // Don't clobber status; preserve whatever it currently is.
  delete (row as Partial<typeof row>).status;

  const { error: updateError } = await supabase
    .from("activities")
    .update(row)
    .eq("id", activityId)
    .eq("instructor_id", auth.profileId);

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/instructor/activities");
  revalidatePath(`/activities/${activityId}`);
  return { ok: true };
}

export async function publishActivityAction(
  activityId: string
): Promise<
  InstructorActionResult & {
    missingFields?: ActivityValidationField[];
  }
> {
  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select(
      `
      *,
      activity_sessions (
        id, starts_at, ends_at, max_seats, seats_remaining, status,
        local_date, local_time
      )
    `
    )
    .eq("id", activityId)
    .eq("instructor_id", auth.profileId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Activity not found" };

  type ActivityRow = {
    latitude: number;
    longitude: number;
    activity_sessions?: SessionLike[];
    [k: string]: unknown;
  };
  const activity = data as ActivityRow;

  // Phase 6B: date/time/max_seats are no longer on the activity. The
  // validator needs them (for historical reasons — a published
  // activity without a publishable session makes no sense) so we
  // synthesize from the primary session. No primary ⇒ no sessions ⇒
  // cannot publish.
  const primary = pickPrimarySession(activity.activity_sessions);
  if (!primary) {
    return {
      ok: false,
      error: "Activity has no sessions to publish",
      missingFields: ["date"],
    };
  }
  const primaryTime = (primary.local_time || "").slice(0, 5);
  const input = {
    ...(activity as unknown as ActivityInput),
    date: primary.local_date ?? "",
    time: primaryTime,
    max_seats: primary.max_seats,
  };
  const geocoded =
    activity.latitude && activity.longitude
      ? { lat: activity.latitude, lng: activity.longitude }
      : null;

  if (!canPublishActivity(input, geocoded)) {
    const err = validateActivityInput(input);
    return {
      ok: false,
      error: err ? err.message : "Activity is missing required fields",
      missingFields: err ? [err.field] : geocoded ? [] : ["address"],
    };
  }

  const { error } = await supabase
    .from("activities")
    .update({ status: "published" })
    .eq("id", activityId)
    .eq("instructor_id", auth.profileId);
  if (error) return { ok: false, error: error.message };

  // Flip any draft sessions on this activity to published too.
  // createActivityAction inserts the first session as 'draft'; publish
  // should make it (and any subsequently added drafts) live.
  // Non-fatal on error — the activity is already published, and the
  // sessions-manager can recover manually.
  const { error: sessionFlipError } = await supabase
    .from("activity_sessions")
    .update({ status: "published" })
    .eq("activity_id", activityId)
    .eq("status", "draft");
  if (sessionFlipError) {
    console.error(
      "[publishActivityAction] failed to flip draft sessions",
      activityId,
      sessionFlipError
    );
  }

  revalidatePath("/instructor/activities");
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  return { ok: true };
}

export async function unpublishActivityAction(
  activityId: string
): Promise<InstructorActionResult> {
  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingCount = await fetchBookingCountForActivity(activityId);
  if (bookingCount > 0) {
    return {
      ok: false,
      error: "Cannot unpublish: activity has active bookings. Cancel first.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("activities")
    .update({ status: "draft" })
    .eq("id", activityId)
    .eq("instructor_id", auth.profileId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/instructor/activities");
  revalidatePath("/activities");
  return { ok: true };
}

export async function duplicateActivityAction(
  activityId: string
): Promise<InstructorActionResult & { newActivityId?: string }> {
  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select(
      `
      *,
      activity_sessions (
        id, starts_at, ends_at, max_seats, seats_remaining, status,
        local_date, local_time
      )
    `
    )
    .eq("id", activityId)
    .eq("instructor_id", auth.profileId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Activity not found" };

  type Row = {
    title: TranslatedField;
    description: TranslatedField;
    category_id: string;
    tags: string[];
    price_cents: number;
    duration_minutes: number;
    address: string;
    neighborhood: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
    cover_image_url: string;
    gallery_image_urls: string[];
    cancellation_policy: "flexible" | "moderate" | "strict";
    cancellation_policy_text: string | null;
    no_show_fee_cents: number | null;
    activity_sessions?: SessionLike[];
  };
  const src = data as Row;

  const addSuffix = (t: TranslatedField): TranslatedField => {
    const suffix = {
      pt: " (Cópia)",
      en: " (Copy)",
      es: " (Copia)",
    } as const;
    return {
      pt: t.pt ? t.pt + suffix.pt : t.pt,
      en: t.en ? t.en + suffix.en : t.en,
      es: t.es ? t.es + suffix.es : t.es,
    };
  };

  // Phase 6B: date/time/max_seats now come from the source activity's
  // primary session. We pick it the same way the public detail page
  // does, then compute a new date 7+ days out.
  const srcPrimary = pickPrimarySession(src.activity_sessions);
  const srcDateStr = srcPrimary?.local_date || null;
  const srcTimeStr = srcPrimary?.local_time?.slice(0, 5) || "09:00";
  const srcMaxSeats = srcPrimary?.max_seats ?? 10;

  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 7);
  const srcDateMs = srcDateStr
    ? new Date(srcDateStr + "T00:00:00").getTime()
    : minDate.getTime();
  const newDate = new Date(
    Math.max(srcDateMs + 7 * 86400_000, minDate.getTime())
  )
    .toISOString()
    .slice(0, 10);

  const { data: inserted, error } = await supabase
    .from("activities")
    .insert({
      instructor_id: auth.profileId,
      title: addSuffix(src.title),
      description: src.description,
      category_id: src.category_id,
      tags: src.tags,
      price_cents: src.price_cents,
      duration_minutes: src.duration_minutes,
      address: src.address,
      neighborhood: src.neighborhood,
      city: src.city,
      state: src.state,
      latitude: src.latitude,
      longitude: src.longitude,
      cover_image_url: src.cover_image_url,
      gallery_image_urls: src.gallery_image_urls,
      cancellation_policy: src.cancellation_policy,
      cancellation_policy_text: src.cancellation_policy_text,
      no_show_fee_cents: src.no_show_fee_cents,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const newActivityId = (inserted as { id: string }).id;

  // Mirror the first session from the source onto the duplicate, using
  // the shifted date but keeping the same wall-clock time and max
  // seats. If the source had no sessions, fall back to defaults that
  // the instructor can edit before publishing.
  const startsAtIso = toSpTimestamptz(newDate, srcTimeStr);
  const endsAtIso = sessionEndsAtIso(startsAtIso, src.duration_minutes);
  const { error: sessionError } = await supabase
    .from("activity_sessions")
    .insert({
      activity_id: newActivityId,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      max_seats: srcMaxSeats,
      seats_remaining: srcMaxSeats,
      status: "draft",
    });
  if (sessionError) {
    await supabase.from("activities").delete().eq("id", newActivityId);
    return { ok: false, error: sessionError.message };
  }

  revalidatePath("/instructor/activities");
  return { ok: true, newActivityId };
}

export async function cancelActivityAction(
  activityId: string,
  reason: string
): Promise<InstructorActionResult & { affectedBookings?: number }> {
  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = await createClient();

  // Pre-flight check so the UI can show a clear message without relying
  // on the Postgres RAISE text. The stored function re-checks these
  // conditions transactionally as the source of truth.
  // Phase 6A: "has not started yet" now means "has at least one future
  // published session" rather than comparing the mirrored
  // `activities.date`. We look up the earliest upcoming published
  // session and treat its date as the cancellable-until boundary.
  const { data: row } = await supabase
    .from("activities")
    .select(
      `
      status,
      activity_sessions (local_date, status)
    `
    )
    .eq("id", activityId)
    .eq("instructor_id", auth.profileId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Activity not found" };

  const today = new Date().toISOString().slice(0, 10);
  const activityRow = row as {
    status: string;
    activity_sessions?: Array<{ local_date: string; status: string }>;
  };
  const earliestUpcoming =
    (activityRow.activity_sessions ?? [])
      .filter((s) => s.status === "published" && s.local_date >= today)
      .map((s) => s.local_date)
      .sort()[0] ?? null;
  if (
    !canCancelActivity({
      status: activityRow.status,
      // Use the earliest upcoming session's date; if none exists
      // (all sessions past), fall back to a sentinel the guard
      // treats as "in the past" so cancellation is blocked.
      date: earliestUpcoming ?? "1970-01-01",
      today,
    })
  ) {
    return { ok: false, error: "Activity cannot be cancelled" };
  }

  // Capture the set of affected booker user_ids AND Stripe payment
  // intents BEFORE the RPC runs. The user_ids let us drain email
  // inboxes after the fact; the payment intents let us issue real
  // refunds if Stripe is enabled. Service role because the caller
  // can't SELECT other users' bookings via RLS.
  const admin = createAdminClient();
  const { data: bookingsBefore } = await admin
    .from("bookings")
    .select("user_id, stripe_payment_id")
    .eq("activity_id", activityId)
    .neq("status", "cancelled");
  const bookingsSnapshot =
    (bookingsBefore as Array<{
      user_id: string;
      stripe_payment_id: string | null;
    }>) || [];
  const affectedUserIds = Array.from(
    new Set(bookingsSnapshot.map((b) => b.user_id))
  );

  const { data, error } = await supabase.rpc("cancel_activity_with_refunds", {
    p_activity_id: activityId,
    p_reason: reason?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  const affectedBookings = typeof data === "number" ? data : 0;

  // Issue real refunds for any Stripe-paid bookings. Failures here
  // don't roll back the DB flip (the activity is genuinely cancelled
  // either way) — we log and continue. A future reconciliation job
  // could retry failed refunds.
  if (isStripeEnabled()) {
    const stripe = getStripeClient();
    for (const b of bookingsSnapshot) {
      if (!b.stripe_payment_id) continue;
      try {
        await stripe.refunds.create({
          payment_intent: b.stripe_payment_id,
          reverse_transfer: true,
          refund_application_fee: true,
        });
      } catch (err) {
        console.error(
          "[stripe:refund] failed for payment_intent",
          b.stripe_payment_id,
          err
        );
      }
    }
  }

  await dispatchEmailsForUsers(affectedUserIds);

  revalidatePath("/instructor/activities");
  revalidatePath(`/instructor/activities/${activityId}`);
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/bookings");
  return { ok: true, affectedBookings };
}

export async function deleteActivityAction(
  activityId: string
): Promise<
  InstructorActionResult & { reason?: "has_bookings"; bookingCount?: number }
> {
  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingCount = await fetchBookingCountForActivity(activityId);
  if (!canDeleteActivity({ bookingCount })) {
    return {
      ok: false,
      error: "Cannot delete: activity has bookings",
      reason: "has_bookings",
      bookingCount,
    };
  }

  const supabase = await createClient();
  const { data: activity } = await supabase
    .from("activities")
    .select("cover_image_url, gallery_image_urls")
    .eq("id", activityId)
    .eq("instructor_id", auth.profileId)
    .maybeSingle();

  if (!activity) return { ok: false, error: "Activity not found" };

  const { error: deleteError } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId)
    .eq("instructor_id", auth.profileId);
  if (deleteError) return { ok: false, error: deleteError.message };

  // Best-effort storage cleanup — failure here is non-fatal, the row is
  // already gone and orphaned objects are at worst a few hundred KB.
  const a = activity as {
    cover_image_url: string;
    gallery_image_urls: string[];
  };
  const urls = [a.cover_image_url, ...(a.gallery_image_urls || [])].filter(
    Boolean
  );
  const objectNames = urls
    .map((url) => extractStorageObjectName(url))
    .filter((n): n is string => Boolean(n));
  if (objectNames.length > 0) {
    await supabase.storage.from("activity-images").remove(objectNames);
  }

  revalidatePath("/instructor/activities");
  return { ok: true };
}

/**
 * Extract the `{instructor_profile_id}/{uuid}.jpg` path out of a public
 * Supabase Storage URL. Returns null for non-matching URLs so we can
 * safely ignore placeholder images seeded from Unsplash.
 */
function extractStorageObjectName(url: string): string | null {
  const marker = "/activity-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

// ------------------------------------------------------------------
// image upload
// ------------------------------------------------------------------

export interface UploadImageResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Client posts a resized JPEG Blob wrapped in FormData; we land it in
 * `activity-images/{instructor_profile_id}/{uuid}.jpg` and return the
 * public URL. The path does NOT include the activity id — the
 * authoritative list of images is the row's `cover_image_url` +
 * `gallery_image_urls` columns.
 */
export async function uploadActivityImageAction(
  formData: FormData
): Promise<UploadImageResult> {
  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided" };
  }

  const supabase = await createClient();
  const uuid = crypto.randomUUID();
  const objectPath = `${auth.profileId}/${uuid}.jpg`;

  const { error } = await supabase.storage
    .from("activity-images")
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (error) return { ok: false, error: error.message };

  const { data: urlData } = supabase.storage
    .from("activity-images")
    .getPublicUrl(objectPath);

  return { ok: true, url: urlData.publicUrl };
}

// ------------------------------------------------------------------
// roster: mark a booker as no-show
// ------------------------------------------------------------------

export async function markNoShowAction(
  bookingId: string
): Promise<InstructorActionResult & { feeCharged?: boolean }> {
  const auth = await requireProfileId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = await createClient();

  // Read the booking + activity in one roundtrip. RLS already scopes
  // bookings by `activities.instructor_id IN (... WHERE user_id =
  // auth.uid())` so the `.eq('activities.instructor_id', ...)` filter
  // is belt-and-braces rather than authoritative.
  // Phase 6A: "activity has happened yet?" is derived from the
  // booking's own session (via `bookings.session_id`), not the
  // mirrored `activities.date`. Important for multi-session
  // activities where the booking might be for a session that hasn't
  // run yet even though the activity's first session has.
  const { data: row } = await supabase
    .from("bookings")
    .select(
      `
      id, user_id, status, no_show, seats_booked,
      activities!inner (
        id, title, no_show_fee_cents, instructor_id
      ),
      session:activity_sessions!session_id (local_date)
    `
    )
    .eq("id", bookingId)
    .eq("activities.instructor_id", auth.profileId)
    .maybeSingle();

  if (!row) return { ok: false, error: "Booking not found" };

  type Joined = {
    id: string;
    user_id: string;
    status: string;
    no_show: boolean;
    seats_booked: number;
    activities: {
      id: string;
      title: TranslatedField;
      no_show_fee_cents: number | null;
    };
    session?: { local_date: string | null } | null;
  };
  const b = row as unknown as Joined;

  const today = new Date().toISOString().slice(0, 10);
  if (
    !canMarkNoShow({
      status: b.status,
      noShow: b.no_show,
      activityDate: b.session?.local_date ?? "1970-01-01",
      today,
    })
  ) {
    return { ok: false, error: "Booking cannot be marked as no-show" };
  }

  const fee = b.activities.no_show_fee_cents || 0;
  const feeCharged = fee > 0;

  // Flip the flags. Status moves to `completed` — a no-show is a
  // completed-but-absent booking for accounting purposes. Seats are
  // NOT released: the seat was consumed even though the booker
  // didn't show up.
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "completed",
      no_show: true,
      no_show_fee_charged: feeCharged,
    })
    .eq("id", bookingId);
  if (updateError) return { ok: false, error: updateError.message };

  // Notify the booker. Admin client because RLS blocks cross-user
  // notification inserts.
  const admin = createAdminClient();
  const activityTitle = b.activities.title?.pt || "atividade";
  const body = feeCharged
    ? `Você foi marcado como ausente na atividade "${activityTitle}". Uma taxa de ${formatCurrency(
        fee
      )} foi registrada.`
    : `Você foi marcado como ausente na atividade "${activityTitle}".`;
  await admin.from("notifications").insert({
    user_id: b.user_id,
    type: "no_show_charged",
    title: "Marcado como ausente",
    body,
    channel: "in_app",
  });

  await dispatchEmailsForUsers([b.user_id]);

  revalidatePath(`/instructor/activities/${b.activities.id}`);
  revalidatePath("/bookings");
  return { ok: true, feeCharged };
}

// ------------------------------------------------------------------
// admin approval (requires role='admin', replaces the Phase 5
// NODE_ENV-guarded dev approval path)
// ------------------------------------------------------------------

export async function approveInstructorAction(
  profileId: string,
  decision: "approved" | "rejected",
  rejectionReason?: string
): Promise<InstructorActionResult> {
  // Inline admin check — importing requireAdmin here would create a
  // dependency cycle with the query layer, and the action already
  // has direct access to the authenticated client.
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { ok: false, error: "Not authenticated" };
  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();
  if ((userRow as { role: string } | null)?.role !== "admin") {
    return { ok: false, error: "Not authorized" };
  }

  // Service-role client for the actual write — the instructor_profiles
  // UPDATE policy requires the owning user_id to match auth.uid(),
  // which is the applicant, not the admin. Bypass RLS deliberately.
  const admin = createAdminClient();

  const updates: {
    approval_status: "approved" | "rejected";
    rejection_reason: string | null;
  } = {
    approval_status: decision,
    rejection_reason:
      decision === "rejected" ? (rejectionReason || "").trim() || null : null,
  };

  const { data: profile, error } = await admin
    .from("instructor_profiles")
    .update(updates)
    .eq("id", profileId)
    .select("user_id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Also promote the user's role if approving so their header picks up
  // the "instructor" affordances going forward.
  const applicantUserId = (profile as { user_id: string }).user_id;
  if (decision === "approved") {
    await admin
      .from("users")
      .update({ role: "instructor" })
      .eq("id", applicantUserId);
  }

  // Audit log row: who did what to whom. Service-role client so
  // we bypass the admin_actions RLS (which only grants SELECT).
  await admin.from("admin_actions").insert({
    admin_user_id: authUser.id,
    action_type:
      decision === "approved"
        ? "instructor_approve"
        : "instructor_reject",
    target_type: "instructor_profile",
    target_id: profileId,
    metadata: {
      applicant_user_id: applicantUserId,
      ...(decision === "rejected" && rejectionReason
        ? { rejection_reason: rejectionReason }
        : {}),
    },
  });

  // The approval-change trigger wrote an instructor_approved /
  // instructor_rejected row for this user; deliver it.
  await dispatchEmailsForUsers([applicantUserId]);

  revalidatePath("/admin/applications");
  revalidatePath("/admin");
  revalidatePath("/instructor", "layout");
  return { ok: true };
}
