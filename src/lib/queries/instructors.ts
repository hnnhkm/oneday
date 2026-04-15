import { createClient } from "@/lib/supabase/server";
import type {
  InstructorProfile,
  TranslatedField,
} from "@/lib/types/database";
import type { ActivityWithInstructor } from "./activities";
import {
  applyLegacySynthesisToRow,
  pickPrimarySession,
  type SessionLike,
} from "@/lib/queries/session-synthesis";

export interface InstructorReviewRow {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  users: { name: string; avatar_url: string | null };
  activities: { id: string; title: TranslatedField };
  review_photos: { id: string; image_url: string }[];
}

export interface InstructorWithUser extends InstructorProfile {
  users: {
    name: string;
    avatar_url: string | null;
    created_at: string;
  };
}

export async function fetchInstructorById(
  id: string
): Promise<InstructorWithUser | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("instructor_profiles")
    .select(
      `
      *,
      users!inner (name, avatar_url, created_at)
    `
    )
    .eq("id", id)
    .eq("approval_status", "approved")
    .single();

  if (error || !data) return null;

  return data as unknown as InstructorWithUser;
}

export async function fetchInstructorActivities(
  instructorId: string
): Promise<ActivityWithInstructor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      *,
      instructor_profiles!inner (
        id,
        user_id,
        users!inner (name, avatar_url)
      ),
      categories!inner (name, slug, icon),
      activity_sessions!inner (
        id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time, quorum_state, instructor_confirmed_at
      )
    `
    )
    .eq("instructor_id", instructorId)
    .eq("status", "published")
    .eq("activity_sessions.status", "published")
    // Show only activities with ≥1 upcoming session (consistent with
    // fetchActivities/fetchRecommendations after the sessions split).
    .gte("activity_sessions.local_date", new Date().toISOString().split("T")[0])
    // Phase 6B: the `activities.date` column is gone. PostgREST can't
    // `.order()` a parent row by an embedded column, so we order
    // server-side for a stable slice and JS-sort by primary session
    // starts_at below. An instructor's public page lists ~10-30
    // activities, so the cost is negligible.
    .order("created_at", { ascending: false });

  if (error) return [];

  const rows = (data as unknown as Array<
    ActivityWithInstructor & { activity_sessions?: SessionLike[] }
  >).map((row) => applyLegacySynthesisToRow(row));

  rows.sort((a, b) => {
    const sa = pickPrimarySession(a.activity_sessions)?.starts_at ?? "";
    const sb = pickPrimarySession(b.activity_sessions)?.starts_at ?? "";
    // Ascending (next upcoming first), matching the previous
    // `.order("date", { ascending: true })` semantics.
    return sa.localeCompare(sb);
  });
  return rows as ActivityWithInstructor[];
}

/**
 * Fetch the most recent reviews across all activities taught by a
 * given instructor. Orders by review created_at descending and joins
 * the reviewer (for name + avatar), the activity (so we can show
 * "for <activity title>" on each card), and the review photos.
 *
 * RLS note: reviews are world-readable, so this runs fine under the
 * user-session client. We still use `activities!inner` so Supabase
 * can filter the join server-side by instructor_id rather than
 * fetching everything and filtering in memory.
 */
export async function fetchInstructorReviews(
  instructorId: string,
  limit: number = 20
): Promise<InstructorReviewRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      id, rating, comment, created_at,
      users!inner (name, avatar_url),
      activities!inner (id, title, instructor_id),
      review_photos (id, image_url)
    `
    )
    .eq("activities.instructor_id", instructorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  // The `instructor_id` came along for the filter but we don't want
  // it on the public shape. Strip it and cast to the row type.
  type Raw = Omit<InstructorReviewRow, "activities"> & {
    activities: { id: string; title: TranslatedField; instructor_id: string };
  };
  return ((data as unknown as Raw[]) || []).map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    users: r.users,
    activities: { id: r.activities.id, title: r.activities.title },
    review_photos: r.review_photos,
  }));
}

export async function fetchInstructorStats(
  instructorId: string
): Promise<{ avgRating: number; reviewCount: number; activityCount: number }> {
  const supabase = await createClient();

  const { count: activityCount } = await supabase
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("instructor_id", instructorId)
    .eq("status", "published");

  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating, activities!inner(instructor_id)")
    .eq("activities.instructor_id", instructorId);

  const reviewCount = reviews?.length || 0;
  const avgRating =
    reviewCount > 0
      ? reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : 0;

  return {
    avgRating: Math.round(avgRating * 10) / 10,
    reviewCount,
    activityCount: activityCount || 0,
  };
}
