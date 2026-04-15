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

/**
 * Returns the existing review for (user, activity) if any, else null.
 * Used by the review page to gate the form (one review per booking).
 */
export async function fetchExistingReview(
  userId: string,
  activityId: string
): Promise<{ id: string; rating: number; comment: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, comment")
    .eq("user_id", userId)
    .eq("activity_id", activityId)
    .maybeSingle();
  return data ?? null;
}
