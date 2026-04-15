import { createClient } from "@/lib/supabase/server";
import type { Booking, TranslatedField, QuorumState } from "@/lib/types/database";

export type BookingTab = "upcoming" | "past" | "cancelled";

export interface BookingWithActivity extends Booking {
  activities: {
    id: string;
    title: TranslatedField;
    date: string;
    time: string;
    duration_minutes: number;
    address: string;
    neighborhood: string;
    city: string;
    cover_image_url: string;
    price_cents: number;
    max_seats: number;
    cancellation_policy: string;
    status: string;
    min_participants: number;
  };
  session?: {
    quorum_state: QuorumState;
  };
}

/**
 * Pure helper: decide which tab a booking belongs to, given "today".
 * - cancelled tab: booking.status === 'cancelled'
 * - upcoming tab: status in (confirmed) AND activity date >= today
 * - past tab: status in (confirmed, completed) AND activity date < today
 * Uses ISO date strings for comparison (YYYY-MM-DD).
 */
export function categorizeBooking(
  booking: { status: string },
  activityDate: string,
  today: string
): BookingTab {
  if (booking.status === "cancelled") return "cancelled";
  if (activityDate < today) return "past";
  return "upcoming";
}

/**
 * Pure helper: can this booking be cancelled by the user right now?
 * Rules: booking must be confirmed AND activity must be in the future.
 * Refund math is deferred (Phase 4) — this just gates the UI affordance.
 */
export function canCancelBooking(
  booking: { status: string },
  activityDate: string,
  today: string
): boolean {
  return booking.status === "confirmed" && activityDate >= today;
}

/**
 * Pure helper: is this booking eligible for a review?
 * Rules: activity must be in the past AND booking must not be cancelled.
 * The "already reviewed" check happens at write time (unique constraint +
 * server-side existence check) since it requires a DB lookup.
 */
export function canReviewBooking(
  booking: { status: string },
  activityDate: string,
  today: string
): boolean {
  return booking.status !== "cancelled" && activityDate < today;
}

/**
 * Pure helper: can the instructor mark this booking as no-show?
 * Rules:
 *  - Activity date must be strictly in the past (you can't no-show
 *    someone for an event that hasn't happened yet, and marking on
 *    the day-of is premature — they might still show up).
 *  - Booking must not be cancelled (a cancelled booking didn't
 *    consume a seat, so there's nothing to no-show).
 *  - Booking must not already be flagged as no-show (this action
 *    is one-way; flipping back isn't supported).
 */
export function canMarkNoShow({
  status,
  noShow,
  activityDate,
  today,
}: {
  status: string;
  noShow: boolean;
  activityDate: string;
  today: string;
}): boolean {
  if (status === "cancelled") return false;
  if (noShow) return false;
  return activityDate < today;
}

/**
 * Fetch a single booking by id, including its activity.
 * Returns null if the booking doesn't exist or RLS hides it
 * (i.e. the caller doesn't own it).
 */
export async function fetchBookingById(
  bookingId: string
): Promise<BookingWithActivity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      *,
      activities!inner (
        id, title, duration_minutes,
        address, neighborhood, city, cover_image_url,
        price_cents, cancellation_policy, status, min_participants
      ),
      session:activity_sessions!session_id (
        local_date, local_time, max_seats, starts_at, quorum_state
      )
    `
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) return null;
  return hoistSessionIntoActivity(data);
}

export async function fetchUserBookings(
  userId: string
): Promise<BookingWithActivity[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      *,
      activities!inner (
        id, title, duration_minutes,
        address, neighborhood, city, cover_image_url,
        price_cents, cancellation_policy, status, min_participants
      ),
      session:activity_sessions!session_id (
        local_date, local_time, max_seats, starts_at, quorum_state
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown[]).map(hoistSessionIntoActivity);
}

/**
 * Phase 6A: the booking embed now pulls date/time/max_seats from the
 * booking's own session row (via `bookings.session_id` FK) instead of
 * the activity's legacy columns. This helper flattens the session
 * fields back onto `booking.activities.{date,time,max_seats}` so
 * downstream readers (confirmation page, bookings tab, review page,
 * instructor roster) don't need to change their field accesses.
 *
 * Every booking has a session (`session_id` is NOT NULL since
 * migration 00020), but we fall back to empty strings / 0 just in
 * case RLS hides the session from a very stale booking. A missing
 * session means a rendering glitch at worst, not a crash.
 */
function hoistSessionIntoActivity(row: unknown): BookingWithActivity {
  const raw = row as {
    activities: {
      id: string;
      title: TranslatedField;
      duration_minutes: number;
      address: string;
      neighborhood: string;
      city: string;
      cover_image_url: string;
      price_cents: number;
      cancellation_policy: string;
      status: string;
      min_participants: number;
    };
    session?: {
      local_date: string | null;
      local_time: string | null;
      max_seats: number;
      starts_at: string;
      quorum_state: QuorumState;
    } | null;
    [k: string]: unknown;
  };
  const s = raw.session;
  const merged: BookingWithActivity = {
    ...(raw as unknown as BookingWithActivity),
    activities: {
      ...raw.activities,
      date: s?.local_date || "",
      time: s?.local_time || "",
      max_seats: s?.max_seats ?? 0,
    },
    session: s
      ? {
          quorum_state: s.quorum_state,
        }
      : undefined,
  };
  return merged;
}
