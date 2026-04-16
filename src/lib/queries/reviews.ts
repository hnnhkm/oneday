import { createClient } from "@/lib/supabase/server";

export interface ReviewInput {
  rating: number;
  comment: string;
}

export interface ReviewValidationError {
  field: "rating" | "comment";
  message: string;
}

/**
 * Pure validator for a review submission.
 * Rules:
 * - rating: integer in [1, 5]
 * - comment: optional; if provided, trimmed length <= 2000
 */
export function validateReview(
  input: Partial<ReviewInput>
): ReviewValidationError | null {
  const rating = input.rating;
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return { field: "rating", message: "Rating must be a whole number from 1 to 5" };
  }

  const comment = (input.comment || "").trim();
  if (comment.length > 2000) {
    return { field: "comment", message: "Comment must be at most 2000 characters" };
  }

  return null;
}

export interface ExistingReview {
  id: string;
  rating: number;
  comment: string;
  photos: { id: string; image_url: string }[];
}

/**
 * Returns the existing review for (user, activity) if any, else null.
 * Now pulls attached photos too, so the review page can render them
 * in edit mode instead of starting from a blank form.
 */
export async function fetchExistingReview(
  userId: string,
  activityId: string
): Promise<ExistingReview | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, comment, review_photos (id, image_url)")
    .eq("user_id", userId)
    .eq("activity_id", activityId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    id: string;
    rating: number;
    comment: string;
    review_photos: { id: string; image_url: string }[] | null;
  };
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    photos: row.review_photos ?? [],
  };
}

/**
 * Batch-fetch existing reviews for (user, many activity ids).
 * Returns a `Map<activityId, {id, rating}>` so the bookings list
 * can render a rated-star label in one DB round-trip instead of N.
 * Photos are not included here — the list UI only needs the number
 * of stars — so we skip the join for speed.
 */
export async function fetchExistingReviewsForActivities(
  userId: string,
  activityIds: string[]
): Promise<Map<string, { id: string; rating: number }>> {
  const out = new Map<string, { id: string; rating: number }>();
  if (activityIds.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, activity_id")
    .eq("user_id", userId)
    .in("activity_id", activityIds);
  for (const row of (data ?? []) as {
    id: string;
    rating: number;
    activity_id: string;
  }[]) {
    out.set(row.activity_id, { id: row.id, rating: row.rating });
  }
  return out;
}
