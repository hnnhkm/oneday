import type {
  CancellationPolicy,
  TranslatedField,
} from "@/lib/types/database";

/**
 * Pure functions extracted from `queries/activities.ts` so that client
 * components can import them without pulling in the server-only
 * Supabase client (which uses `next/headers` and is blocked in the
 * browser bundle). No DB access here — unit-tested with Jest.
 */

export interface ActivityInput {
  title: TranslatedField;
  description: TranslatedField;
  category_id: string;
  tags: string[];
  price_cents: number;
  date: string;
  time: string;
  duration_minutes: number;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  /**
   * Optional coordinates picked on the map. When present, the server
   * action uses these as-is instead of re-geocoding from the address
   * fields — the instructor's explicit pin is authoritative.
   */
  latitude?: number | null;
  longitude?: number | null;
  max_seats: number;
  min_participants: number;
  cover_image_url: string;
  gallery_image_urls: string[];
  cancellation_policy: CancellationPolicy;
  cancellation_policy_text: string | null;
  no_show_fee_cents: number | null;
}

export type ActivityValidationField =
  | "title"
  | "description"
  | "category_id"
  | "price_cents"
  | "max_seats"
  | "min_participants"
  | "duration_minutes"
  | "date"
  | "time"
  | "address"
  | "city"
  | "state"
  | "cover_image_url"
  | "gallery_image_urls"
  | "cancellation_policy";

export interface ActivityValidationError {
  field: ActivityValidationField;
  message: string;
}

const VALID_POLICIES: ReadonlyArray<CancellationPolicy> = [
  "flexible",
  "moderate",
  "strict",
];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateActivityInput(
  input: ActivityInput
): ActivityValidationError | null {
  if (!input.title || !input.title.pt || !input.title.pt.trim()) {
    return { field: "title", message: "Title (pt) is required" };
  }
  if (
    !input.description ||
    !input.description.pt ||
    !input.description.pt.trim()
  ) {
    return { field: "description", message: "Description (pt) is required" };
  }
  if (!input.category_id || !input.category_id.trim()) {
    return { field: "category_id", message: "Category is required" };
  }
  if (
    !Number.isFinite(input.price_cents) ||
    input.price_cents < 500 ||
    input.price_cents > 1_000_000
  ) {
    return {
      field: "price_cents",
      message: "Price must be between R$ 5,00 and R$ 10.000,00",
    };
  }
  if (
    !Number.isInteger(input.max_seats) ||
    input.max_seats < 1 ||
    input.max_seats > 50
  ) {
    return { field: "max_seats", message: "Max seats must be between 1 and 50" };
  }
  if (
    !Number.isInteger(input.min_participants) ||
    input.min_participants < 0 ||
    input.min_participants > input.max_seats
  ) {
    return {
      field: "min_participants",
      message: "Minimum participants must be between 0 and max seats",
    };
  }
  if (
    !Number.isInteger(input.duration_minutes) ||
    input.duration_minutes < 30 ||
    input.duration_minutes > 480 ||
    input.duration_minutes % 30 !== 0
  ) {
    return {
      field: "duration_minutes",
      message:
        "Duration must be between 30 and 480 minutes in 30-minute increments",
    };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (!input.date || input.date < today) {
    return { field: "date", message: "Date must be today or later" };
  }
  if (!HHMM.test(input.time || "")) {
    return { field: "time", message: "Time must be HH:MM" };
  }
  if (!input.address || !input.address.trim()) {
    return { field: "address", message: "Address is required" };
  }
  if (!input.city || !input.city.trim()) {
    return { field: "city", message: "City is required" };
  }
  if (!input.state || !input.state.trim()) {
    return { field: "state", message: "State is required" };
  }
  if (!input.cover_image_url || !input.cover_image_url.trim()) {
    return { field: "cover_image_url", message: "Cover image is required" };
  }
  // Require 5 photos total (1 cover + 4 gallery). The cover counts as
  // photo #1, so the gallery must carry at least 4 more. Upper bound
  // stays at 10 gallery images (11 total) — unchanged.
  if (
    !Array.isArray(input.gallery_image_urls) ||
    input.gallery_image_urls.length < 4 ||
    input.gallery_image_urls.length > 10
  ) {
    return {
      field: "gallery_image_urls",
      message:
        "Activity must have at least 5 photos (cover + 4 gallery); gallery can have up to 10",
    };
  }
  if (!VALID_POLICIES.includes(input.cancellation_policy)) {
    return {
      field: "cancellation_policy",
      message: "Cancellation policy must be flexible, moderate, or strict",
    };
  }
  return null;
}

export function canPublishActivity(
  input: ActivityInput,
  geocoded: { lat: number; lng: number } | null
): boolean {
  if (validateActivityInput(input) !== null) return false;
  if (!geocoded) return false;
  if (!input.cover_image_url) return false;
  return true;
}

export function canDeleteActivity({
  bookingCount,
}: {
  bookingCount: number;
}): boolean {
  return bookingCount === 0;
}

export function canCancelActivity({
  status,
  date,
  today,
}: {
  status: string;
  date: string;
  today: string;
}): boolean {
  if (status !== "published") return false;
  return date >= today;
}

/**
 * Pure guard for "can this user book this activity?" Covers two
 * cases that the booking RPC also catches server-side, but which
 * we want to catch earlier (in the client form + the checkout
 * server action) so the UX is friendlier than a raw SQL error:
 *
 *   - Not authenticated: the user menu hides the book button
 *     already, but a hand-crafted form submission could still
 *     reach the server action. Defense in depth.
 *   - Self-booking: instructors can book other instructors'
 *     activities (the whole point of the "instructors are users
 *     too" feature) but must not be able to book their own.
 *
 * Returns `null` on success or a structured reason so callers can
 * localize the message. Intentionally passes through when the
 * instructor's user id isn't known — some call sites don't join
 * instructor_profiles and we'd rather let the SQL layer catch
 * self-booking than produce a false positive.
 */
export type CannotBookReason = "not_authenticated" | "own_activity";

export function canUserBookActivity({
  userId,
  instructorUserId,
}: {
  userId: string | null | undefined;
  instructorUserId: string | null | undefined;
}): { reason: CannotBookReason } | null {
  if (!userId) return { reason: "not_authenticated" };
  if (!instructorUserId) return null;
  if (userId === instructorUserId) return { reason: "own_activity" };
  return null;
}
