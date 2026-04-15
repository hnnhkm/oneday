import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/ui/star-rating";
import { ActivityGrid } from "@/components/activities/activity-grid";
import { InstructorReviewsList } from "@/components/instructor/instructor-reviews-list";
import { formatDate } from "@/lib/utils";
import {
  fetchInstructorById,
  fetchInstructorActivities,
  fetchInstructorStats,
  fetchInstructorReviews,
} from "@/lib/queries/instructors";

interface InstructorProfilePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: InstructorProfilePageProps): Promise<Metadata> {
  const { id } = await params;
  const instructor = await fetchInstructorById(id);

  if (!instructor) return { title: "Not Found" };

  const name = instructor.users.name;
  const bio = instructor.bio || "";
  const truncatedBio =
    bio.length > 160 ? bio.slice(0, 157) + "..." : bio;

  return {
    title: `${name} | oneday`,
    description: truncatedBio || `Instructor profile: ${name}`,
    openGraph: {
      title: name,
      description: truncatedBio || `Instructor profile: ${name}`,
      images: instructor.users.avatar_url
        ? [{ url: instructor.users.avatar_url }]
        : [],
    },
  };
}

export default async function InstructorProfilePage({
  params,
}: InstructorProfilePageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("instructor");

  const instructor = await fetchInstructorById(id);
  if (!instructor) notFound();

  const [activities, stats, reviews] = await Promise.all([
    fetchInstructorActivities(id),
    fetchInstructorStats(id),
    fetchInstructorReviews(id, 20),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Profile header */}
      <div className="bg-white rounded-lg shadow-card p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <Avatar
            src={instructor.users.avatar_url}
            name={instructor.users.name}
            size="lg"
            className="h-24 w-24 text-2xl"
          />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-charcoal">
              {instructor.users.name}
            </h1>
            <p className="text-sm text-charcoal-lighter mt-1">
              {t("memberSince", {
                date: formatDate(instructor.users.created_at, locale),
              })}
            </p>

            {/* Stats */}
            <div className="flex items-center gap-4 mt-3">
              {stats.avgRating > 0 && (
                <div className="flex items-center gap-1">
                  <StarRating rating={stats.avgRating} />
                  <span className="text-sm font-medium">
                    {stats.avgRating}
                  </span>
                  <span className="text-sm text-charcoal-lighter">
                    ({stats.reviewCount})
                  </span>
                </div>
              )}
              <span className="text-sm text-charcoal-lighter">
                {t("activitiesCount", { count: stats.activityCount })}
              </span>
            </div>

            {/* Specialties */}
            {instructor.specialties && instructor.specialties.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-charcoal mb-2">
                  {t("specialties")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {instructor.specialties.map((specialty) => (
                    <Badge key={specialty} variant="secondary">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {instructor.bio && (
          <div className="mt-6 border-t border-charcoal-lighter/10 pt-6">
            <p className="text-charcoal-lighter whitespace-pre-line leading-relaxed">
              {instructor.bio}
            </p>
          </div>
        )}
      </div>

      {/* Upcoming activities */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-charcoal mb-6">
          {t("upcomingActivities")}
        </h2>
        {activities.length > 0 ? (
          <ActivityGrid activities={activities} locale={locale} />
        ) : (
          <p className="text-charcoal-lighter py-8 text-center">
            {t("noUpcoming")}
          </p>
        )}
      </div>

      {/* Reviews */}
      <div>
        <h2 className="text-xl font-bold text-charcoal mb-6">
          {t("reviews.title")}
        </h2>
        <InstructorReviewsList reviews={reviews} locale={locale} />
      </div>
    </div>
  );
}
