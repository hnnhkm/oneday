import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { ActivityImageGallery } from "@/components/activities/activity-image-gallery";
import { ActivityCarousel } from "@/components/activities/activity-carousel";
import { ShareButtons } from "@/components/activities/share-buttons";
import { FavoriteButton } from "@/components/activities/favorite-button";
import { BookingForm } from "@/components/activities/booking-form";
import { BookingFlowProvider } from "@/components/activities/booking-flow/booking-flow-context";
import { SessionPicker } from "@/components/activities/booking-flow/session-picker";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { getUser } from "@/lib/supabase/get-user";
import { isFavorited as checkIsFavorited } from "@/lib/queries/favorites";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/ui/star-rating";
import {
  formatCurrency,
  formatDate,
  formatDurationHours,
  getTranslatedField,
} from "@/lib/utils";
import {
  fetchActivityById,
  fetchActivityReviews,
  fetchRecommendations,
} from "@/lib/queries/activities";
import type { TranslatedField } from "@/lib/types/database";

interface ActivityDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ActivityDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const locale = await getLocale();
  const activity = await fetchActivityById(id);

  if (!activity) return { title: "Not Found" };

  const title = getTranslatedField(activity.title as TranslatedField, locale);
  const description = getTranslatedField(
    activity.description as TranslatedField,
    locale
  );
  const truncatedDesc =
    description.length > 160 ? description.slice(0, 157) + "..." : description;

  return {
    title: `${title} | oneday`,
    description: truncatedDesc,
    openGraph: {
      title,
      description: truncatedDesc,
      images: activity.cover_image_url
        ? [{ url: activity.cover_image_url }]
        : [],
    },
  };
}

export default async function ActivityDetailPage({
  params,
}: ActivityDetailPageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("activities");

  const activity = await fetchActivityById(id);
  if (!activity) notFound();

  const currentUser = await getUser();
  const [reviews, recommendations, favorited] = await Promise.all([
    fetchActivityReviews(id),
    fetchRecommendations(id, activity.category_id, activity.city, 4),
    currentUser ? checkIsFavorited(currentUser.id, id) : Promise.resolve(false),
  ]);

  const title = getTranslatedField(activity.title as TranslatedField, locale);
  const description = getTranslatedField(
    activity.description as TranslatedField,
    locale
  );
  const categoryName = getTranslatedField(
    activity.categories.name as unknown as TranslatedField,
    locale
  );
  const instructor = activity.instructor_profiles as typeof activity.instructor_profiles & {
    bio?: string;
  };
  const isSoldOut = activity.seats_remaining === 0;
  const isOwnActivity = !!currentUser && currentUser.id === instructor.user_id;

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const shareText = `${title} - ${formatCurrency(activity.price_cents)} - ${formatDate(activity.date, locale)}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const shareUrl = `${appUrl}/${locale}/activities/${activity.id}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* BookingFlowProvider wraps the whole two-column layout so the
          SessionPicker (left column) and BookingForm (right sidebar)
          share `selectedSessionId` without lifting state through this
          server component. The provider itself is a client boundary
          but doesn't render anything visible — children flow through
          unchanged, just with access to `useBookingFlow()`. */}
      <BookingFlowProvider sessions={activity.activity_sessions ?? []} minParticipants={activity.min_participants}>
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left column: images + picker + description */}
        <div className="flex-1">
          <ActivityImageGallery
            coverImage={activity.cover_image_url}
            galleryImages={activity.gallery_image_urls}
            title={title}
          />

          {/* Details card — title, description, instructor, and reviews
              are grouped into a single white card so they read as one
              coherent "about this activity" block rather than separate
              floating sections. Inner hairline dividers separate each
              sub-section without breaking the outer container. */}
          <div className="mt-6 rounded-lg bg-white shadow-card p-6">
            {/* Title + category + favorite */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge className="mb-2">
                  {activity.categories.icon} {categoryName}
                </Badge>
                <h1 className="text-2xl md:text-3xl font-bold text-charcoal">
                  {title}
                </h1>
              </div>
              <FavoriteButton
                activityId={activity.id}
                initialFavorited={favorited}
                requiresAuth={!currentUser}
              />
            </div>

            {/* Description */}
            <p className="mt-6 text-charcoal-lighter whitespace-pre-line leading-relaxed">
              {description}
            </p>

            {/* Instructor */}
            <div className="mt-6 border-t border-charcoal-lighter/10 pt-6">
              <h2 className="text-lg font-semibold text-charcoal mb-4">
                {t("aboutInstructor")}
              </h2>
              <Link href={`/instructors/${instructor.id}`}>
                <div className="flex items-center gap-3 group">
                  <Avatar
                    src={instructor.users.avatar_url}
                    name={instructor.users.name}
                    size="lg"
                  />
                  <div>
                    <p className="font-semibold text-charcoal group-hover:text-primary-400 transition-colors">
                      {instructor.users.name}
                    </p>
                    {instructor.bio && (
                      <p className="text-sm text-charcoal-lighter line-clamp-2 mt-1">
                        {instructor.bio}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </div>

            {/* Reviews */}
            <div className="mt-6 border-t border-charcoal-lighter/10 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-charcoal">
                  {reviews.length > 0
                    ? t("reviews", { count: reviews.length })
                    : t("noReviews")}
                </h2>
                {reviews.length > 0 && (
                  <StarRating
                    rating={avgRating}
                    showCount
                    count={reviews.length}
                  />
                )}
              </div>

              {/* Individual reviews sit on a muted background so they're
                  still distinguishable from each other now that the
                  outer card is already white. */}
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-background-muted rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar
                        src={review.users.avatar_url}
                        name={review.users.name}
                        size="sm"
                      />
                      <span className="font-medium text-sm">
                        {review.users.name}
                      </span>
                      <StarRating rating={review.rating} />
                    </div>
                    {review.comment && (
                      <p className="text-sm text-charcoal-lighter">
                        {review.comment}
                      </p>
                    )}
                    <PhotoLightbox photos={review.review_photos || []} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Session picker — calendar strip + time-slot grid. Placed
              below the details card so the user reads what the
              activity is about first, then picks a date/time. On
              mobile this also means the picker sits right above the
              booking sidebar (which stacks below on narrow viewports),
              keeping picker and submit in the same thumb zone.
              Hidden entirely for activities with zero published
              sessions via an internal `groups.length === 0` guard. */}
          <div className="mt-6">
            <SessionPicker />
          </div>
        </div>

        {/* Right column: booking sidebar */}
        <aside className="w-full lg:w-80 flex-shrink-0">
          <div className="sticky top-20 bg-white rounded-lg shadow-card p-6 space-y-4">
            {/* Price */}
            <div>
              <span className="text-3xl font-bold text-primary-400">
                {formatCurrency(activity.price_cents)}
              </span>
              <span className="text-charcoal-lighter ml-1">
                {t("perPerson")}
              </span>
            </div>

            {/* Static activity-level details — duration and location.
                The date/time rows that used to live here moved into
                the `SessionPicker`, which now owns the "when" answer.
                Duration stays at the activity level (cooking class is
                always 3h regardless of which session); location is
                the same for every session so it stays here too. */}
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 leading-5">
                <span>⏱️</span>
                <span>{formatDurationHours(activity.duration_minutes)}</span>
              </div>
              <div className="flex items-start gap-2 leading-5">
                <span>📍</span>
                <span>
                  {activity.address}, {activity.neighborhood}
                </span>
              </div>
            </div>

            {/* Booking form — reads selected session from
                `BookingFlowProvider` above. Renders a selected-session
                summary row + seats select + submit. If the activity
                has zero bookable sessions the form falls through to
                a disabled "sold out" state driven by `isSoldOut`. */}
            <div className="pt-2">
              <BookingForm
                pricePerSeatCents={activity.price_cents}
                isAuthed={!!currentUser}
                isSoldOut={isSoldOut}
                isOwnActivity={isOwnActivity}
                minParticipants={activity.min_participants}
              />
            </div>

            {/* Cancellation policy */}
            <div className="border-t border-charcoal-lighter/10 pt-4">
              <p className="text-xs font-medium text-charcoal mb-1">
                {t("cancellationPolicy")}
              </p>
              <p className="text-xs text-charcoal-lighter">
                {t(activity.cancellation_policy)}
              </p>
              {activity.cancellation_policy_text && (
                <p className="text-xs text-charcoal-lighter mt-1">
                  {activity.cancellation_policy_text}
                </p>
              )}
            </div>

            {/* No-show fee */}
            {activity.no_show_fee_cents && activity.no_show_fee_cents > 0 && (
              <div className="border-t border-charcoal-lighter/10 pt-4">
                <p className="text-xs text-accent-600">
                  {t("noShowFee", {
                    fee: formatCurrency(activity.no_show_fee_cents),
                  })}
                </p>
              </div>
            )}

            {/* Share */}
            <ShareButtons title={title} shareText={shareText} url={shareUrl} />
          </div>
        </aside>
      </div>
      </BookingFlowProvider>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-12 border-t border-charcoal-lighter/10 pt-8">
          <h2 className="text-xl font-bold text-charcoal mb-6">
            {t("recommendations")}
          </h2>
          <ActivityCarousel activities={recommendations} locale={locale} />
        </div>
      )}
    </div>
  );
}
