import { createClient } from "@/lib/supabase/server";
import type { ActivityWithInstructor } from "@/lib/queries/activities";
import {
  applyLegacySynthesisToRow,
  type SessionLike,
} from "@/lib/queries/session-synthesis";

export async function fetchUserFavorites(
  userId: string
): Promise<ActivityWithInstructor[]> {
  const supabase = await createClient();

  // Phase 6B: embed sessions so the favorited activity cards can render
  // `row.date / row.time / row.max_seats / row.seats_remaining` via the
  // same synthesis helper the grid + instructor pages use. The legacy
  // columns on `activities` are gone post-00023.
  const { data, error } = await supabase
    .from("favorites")
    .select(
      `
      activity_id,
      activities!inner (
        *,
        instructor_profiles!inner (
          id,
          user_id,
          users!inner (name, avatar_url)
        ),
        categories!inner (name, slug, icon),
        reviews (rating),
        activity_sessions (
          id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time, quorum_state, instructor_confirmed_at
        )
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data
    .map((row) => {
      const activity = (row as unknown as {
        activities: ActivityWithInstructor & {
          activity_sessions?: SessionLike[];
        };
      }).activities;
      const reviews = (activity as unknown as { reviews?: { rating: number }[] })
        .reviews || [];
      const review_count = reviews.length;
      const avg_rating =
        review_count > 0
          ? reviews.reduce((s, r) => s + r.rating, 0) / review_count
          : 0;
      return applyLegacySynthesisToRow({
        ...activity,
        avg_rating,
        review_count,
      });
    })
    .filter((a) => a.status === "published");
}

export async function fetchFavoriteActivityIds(
  userId: string
): Promise<Set<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("favorites")
    .select("activity_id")
    .eq("user_id", userId);

  if (error || !data) return new Set();

  return new Set(data.map((row) => row.activity_id as string));
}

export async function isFavorited(
  userId: string,
  activityId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("activity_id", activityId)
    .maybeSingle();

  return !!data;
}
