import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/avatar";
import { StarRating } from "@/components/ui/star-rating";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { Link } from "@/i18n/navigation";
import { formatDate, getTranslatedField } from "@/lib/utils";
import type { InstructorReviewRow } from "@/lib/queries/instructors";

/**
 * Renders the "what students are saying" section of an instructor's
 * public profile. Server component — receives pre-fetched rows from
 * fetchInstructorReviews so the parent page controls the limit and
 * decides whether to render an empty state above or below.
 *
 * Each card shows:
 *   - reviewer avatar + name
 *   - star rating
 *   - review date
 *   - "for <activity title>" link back to the activity detail page
 *   - comment body (if any)
 *   - review photos (if any), as a horizontal thumbnail strip
 *
 * Mirrors the review card styling from the activity detail page so
 * the two surfaces feel consistent.
 */
export async function InstructorReviewsList({
  reviews,
  locale,
}: {
  reviews: InstructorReviewRow[];
  locale: string;
}) {
  const t = await getTranslations("instructor.reviews");

  if (reviews.length === 0) {
    return (
      <p className="text-charcoal-lighter py-6 text-center">
        {t("noneYet")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const activityTitle = getTranslatedField(review.activities.title, locale);
        return (
          <article
            key={review.id}
            className="bg-white rounded-lg p-4 shadow-card"
          >
            <div className="flex items-center gap-3 mb-2">
              <Avatar
                src={review.users.avatar_url}
                name={review.users.name}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-charcoal">
                    {review.users.name}
                  </span>
                  <StarRating rating={review.rating} />
                </div>
                <div className="text-xs text-charcoal-lighter mt-0.5">
                  {formatDate(review.created_at.slice(0, 10), locale)}
                  {" · "}
                  <Link
                    href={`/activities/${review.activities.id}`}
                    className="underline hover:text-primary-500"
                  >
                    {activityTitle}
                  </Link>
                </div>
              </div>
            </div>

            {review.comment && (
              <p className="text-sm text-charcoal-lighter whitespace-pre-line">
                {review.comment}
              </p>
            )}

            <PhotoLightbox photos={review.review_photos || []} />
          </article>
        );
      })}
    </div>
  );
}
