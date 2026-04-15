import { createClient } from "@/lib/supabase/server";
import type {
  Activity,
  ActivitySession,
  ActivityStatus,
  Booking,
  InstructorProfile,
  Payout,
  TranslatedField,
} from "@/lib/types/database";
import {
  applyLegacySynthesisToRow,
  pickPrimarySession,
  type SessionLike,
} from "@/lib/queries/session-synthesis";
// Re-exported for backwards compat with existing imports on the
// instructor side; shared with the regular-user notifications page.
export { fetchUserNotifications as fetchInstructorNotifications } from "@/lib/queries/notifications";

/**
 * Queries consumed by the instructor-side pages. These are intentionally
 * thin wrappers — no joins/heuristics that aren't directly displayed.
 *
 * Row-level security enforces ownership for all of these; in practice
 * passing `instructor_profile_id` is belt-and-braces so the page code
 * can't accidentally over-fetch if RLS is relaxed later.
 */

export async function fetchInstructorProfileByUserId(
  userId: string
): Promise<InstructorProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instructor_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as InstructorProfile) ?? null;
}

export async function fetchMyActivities(
  instructorProfileId: string
): Promise<Activity[]> {
  const supabase = await createClient();
  // Phase 6A: instructor list sorts by the primary session's starts_at
  // instead of the legacy `activities.date`. PostgREST can't order by
  // an embedded column, so we order by `created_at DESC` server-side
  // for a deterministic slice and then JS-sort by session date below.
  // The instructor's catalog is small (dozens of rows at most), so
  // the cost is negligible.
  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      *,
      activity_sessions (
        id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time
      )
    `
    )
    .eq("instructor_id", instructorProfileId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  const rows = (data as unknown as Array<
    Activity & { activity_sessions?: SessionLike[] }
  >).map((row) => applyLegacySynthesisToRow(row));
  rows.sort((a, b) => {
    const sa = pickPrimarySession(a.activity_sessions)?.starts_at ?? "";
    const sb = pickPrimarySession(b.activity_sessions)?.starts_at ?? "";
    // Descending (newest/furthest-in-future first), matching the
    // previous `.order("date", { ascending: false })` semantics.
    return sb.localeCompare(sa);
  });
  return rows as Activity[];
}

export async function fetchMyActivityById(
  activityId: string,
  instructorProfileId: string
): Promise<Activity | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select(
      `
      *,
      activity_sessions (
        id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time
      )
    `
    )
    .eq("id", activityId)
    .eq("instructor_id", instructorProfileId)
    .maybeSingle();
  if (!data) return null;
  return applyLegacySynthesisToRow(
    data as unknown as Activity & { activity_sessions?: SessionLike[] }
  ) as Activity;
}

/**
 * Row returned by `fetchActivitySessions`. Adds a denormalized
 * `booked_seats` (max_seats − seats_remaining) so the sessions
 * panel can render "3/10 booked" without re-running the math
 * everywhere.
 */
export interface SessionRow extends ActivitySession {
  booked_seats: number;
}

/**
 * All sessions belonging to an activity, ordered chronologically.
 * Instructor-scoped via the `instructor_profile_id` guard so the
 * caller can't accidentally list sessions they don't own. RLS would
 * catch it too, but an explicit filter makes the intent clear and
 * keeps query plans predictable.
 */
export async function fetchActivitySessions(
  activityId: string,
  instructorProfileId: string
): Promise<SessionRow[]> {
  const supabase = await createClient();

  // Verify ownership first — cheap, and means a bogus/mismatched id
  // short-circuits without a broader query.
  const { data: owner } = await supabase
    .from("activities")
    .select("id")
    .eq("id", activityId)
    .eq("instructor_id", instructorProfileId)
    .maybeSingle();
  if (!owner) return [];

  const { data, error } = await supabase
    .from("activity_sessions")
    .select("*")
    .eq("activity_id", activityId)
    .order("starts_at", { ascending: true });

  if (error || !data) return [];
  return (data as ActivitySession[]).map((s) => ({
    ...s,
    booked_seats: s.max_seats - s.seats_remaining,
  }));
}

export interface ActivityBookingRow extends Booking {
  users: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

export async function fetchActivityBookings(
  activityId: string
): Promise<ActivityBookingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      *,
      users!inner (id, name, avatar_url)
    `
    )
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as ActivityBookingRow[];
}

export interface InstructorBookingRow extends Booking {
  activities: {
    id: string;
    title: TranslatedField;
    date: string;
    time: string;
    cover_image_url: string;
    neighborhood: string;
    city: string;
  };
  users: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

export async function fetchAllInstructorBookings(
  instructorProfileId: string
): Promise<InstructorBookingRow[]> {
  const supabase = await createClient();
  // Phase 6A: date/time come from the booking's own session (via
  // `bookings.session_id`), not the mirrored `activities.date|time`.
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      *,
      activities!inner (
        id, title, cover_image_url,
        neighborhood, city, instructor_id
      ),
      session:activity_sessions!session_id (local_date, local_time),
      users!inner (id, name, avatar_url)
    `
    )
    .eq("activities.instructor_id", instructorProfileId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  type Raw = {
    activities: {
      id: string;
      title: TranslatedField;
      cover_image_url: string;
      neighborhood: string;
      city: string;
      instructor_id: string;
    };
    session?: { local_date: string | null; local_time: string | null } | null;
    [k: string]: unknown;
  };
  return (data as unknown as Raw[]).map((raw) => {
    const merged = {
      ...(raw as unknown as InstructorBookingRow),
      activities: {
        ...raw.activities,
        date: raw.session?.local_date || "",
        time: raw.session?.local_time || "",
      },
    };
    delete (merged as unknown as { session?: unknown }).session;
    return merged;
  });
}

export interface DashboardStats {
  totalActivities: number;
  upcomingActivitiesCount: number;
  upcomingBookingsCount: number;
  monthToDateEarningsCents: number;
  allTimeEarningsCents: number;
  avgRating: number;
  reviewCount: number;
}

export async function fetchDashboardStats(
  instructorProfileId: string,
  commissionRate: number
): Promise<DashboardStats> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";

  // Phase 6A: "upcoming activity" now means "activity with at least one
  // published, future session". We fetch sessions instead of relying on
  // the mirrored `activities.date` column.
  const { data: activities } = await supabase
    .from("activities")
    .select(
      `
      id, status,
      activity_sessions (local_date, status)
    `
    )
    .eq("instructor_id", instructorProfileId);

  const activityList = (activities as Array<{
    id: string;
    status: ActivityStatus;
    activity_sessions?: Array<{ local_date: string; status: ActivityStatus }>;
  }>) || [];

  const totalActivities = activityList.length;
  const upcomingActivitiesCount = activityList.filter(
    (a) =>
      a.status === "published" &&
      (a.activity_sessions ?? []).some(
        (s) => s.status === "published" && s.local_date >= today
      )
  ).length;

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `
      id, status, total_price_cents, created_at,
      activities!inner (id, instructor_id),
      session:activity_sessions!session_id (local_date)
    `
    )
    .eq("activities.instructor_id", instructorProfileId);

  type BookingJoin = {
    id: string;
    status: string;
    total_price_cents: number;
    created_at: string;
    activities: { id: string; instructor_id: string };
    session?: { local_date: string } | null;
  };
  const bookingList = (bookings as unknown as BookingJoin[]) || [];

  const keep = bookingList.filter(
    (b) => b.status === "confirmed" || b.status === "completed"
  );

  // "Upcoming" booking = booking whose session hasn't happened yet. Uses
  // the booking's own session (via `bookings.session_id`), not the
  // mirrored activity date — important once multi-session activities
  // land since the booking might be for the second session even when
  // the first has passed.
  const upcomingBookingsCount = keep.filter(
    (b) => (b.session?.local_date ?? "") >= today
  ).length;

  const net = (cents: number) => Math.round(cents * (1 - commissionRate));

  const allTimeEarningsCents = keep.reduce(
    (sum, b) => sum + net(b.total_price_cents),
    0
  );
  const monthToDateEarningsCents = keep
    .filter((b) => b.created_at >= firstOfMonth + "T00:00:00")
    .reduce((sum, b) => sum + net(b.total_price_cents), 0);

  // Reviews across all owned activities
  const ids = activityList.map((a) => a.id);
  let avgRating = 0;
  let reviewCount = 0;
  if (ids.length > 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("rating")
      .in("activity_id", ids);
    const ratings = (reviews as Array<{ rating: number }>) || [];
    reviewCount = ratings.length;
    avgRating =
      ratings.length > 0
        ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
        : 0;
  }

  return {
    totalActivities,
    upcomingActivitiesCount,
    upcomingBookingsCount,
    monthToDateEarningsCents,
    allTimeEarningsCents,
    avgRating,
    reviewCount,
  };
}

/**
 * Lightweight booking fetch for the earnings summary widget on
 * /instructor/payouts. Returns only the columns the pure calculator
 * (computeInstructorEarnings) cares about, so the row shape matches
 * EarningsBookingRow directly.
 *
 * Filters cancelled bookings in SQL to keep the payload small —
 * the calculator also excludes them, but there's no reason to
 * ship them over the wire.
 */
export async function fetchInstructorBookingsForEarnings(
  instructorProfileId: string
): Promise<
  Array<{
    status: "confirmed" | "cancelled" | "completed";
    total_price_cents: number;
    refund_amount_cents: number;
    activity_date: string;
  }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      status, total_price_cents, refund_amount_cents,
      activities!inner (instructor_id),
      session:activity_sessions!session_id (local_date)
    `
    )
    .eq("activities.instructor_id", instructorProfileId)
    .neq("status", "cancelled");

  if (error || !data) return [];

  // Phase 6A: earnings bucketing uses the booking's own session date.
  // Previously this read `activities.date`, which is fine while the
  // mirror trigger holds but wrong once multi-session activities exist.
  type Raw = {
    status: "confirmed" | "cancelled" | "completed";
    total_price_cents: number;
    refund_amount_cents: number;
    activities: { instructor_id: string };
    session?: { local_date: string } | null;
  };
  return (data as unknown as Raw[]).map((r) => ({
    status: r.status,
    total_price_cents: r.total_price_cents,
    refund_amount_cents: r.refund_amount_cents,
    activity_date: r.session?.local_date ?? "",
  }));
}

export async function fetchInstructorPayouts(
  instructorProfileId: string
): Promise<Payout[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payouts")
    .select("*")
    .eq("instructor_id", instructorProfileId)
    .order("period_end", { ascending: false });
  return (data as Payout[]) || [];
}

export async function fetchBookingCountForActivity(
  activityId: string
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", activityId)
    .neq("status", "cancelled");
  return count || 0;
}

export async function fetchPendingApplications(): Promise<
  Array<InstructorProfile & { users: { name: string; email: string; avatar_url: string | null } }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instructor_profiles")
    .select(
      `
      *,
      users!inner (name, email, avatar_url)
    `
    )
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false });
  return (data as unknown as Array<
    InstructorProfile & {
      users: { name: string; email: string; avatar_url: string | null };
    }
  >) || [];
}
