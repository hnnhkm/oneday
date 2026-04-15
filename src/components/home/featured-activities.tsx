import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getTranslatedField } from "@/lib/utils";
import type { ActivityWithInstructor } from "@/lib/queries/activities";
import type { TranslatedField } from "@/lib/types/database";

interface FeaturedActivitiesProps {
  activities: ActivityWithInstructor[];
  locale: string;
  title: string;
  seeAllLabel: string;
}

export function FeaturedActivities({
  activities,
  locale,
  title,
  seeAllLabel,
}: FeaturedActivitiesProps) {
  if (activities.length === 0) return null;

  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-2xl font-bold text-charcoal mb-6 text-center">
          {title}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {activities.map((activity) => {
            const actTitle = getTranslatedField(
              activity.title as TranslatedField,
              locale
            );
            const categoryName = getTranslatedField(
              activity.categories?.name as unknown as TranslatedField,
              locale
            );

            return (
              <Link
                key={activity.id}
                href={`/activities/${activity.id}`}
                className="group rounded-lg bg-white shadow-card hover:shadow-card-hover transition-shadow overflow-hidden"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={activity.cover_image_url}
                    alt={actTitle}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  {categoryName && (
                    <span className="absolute top-2 left-2 text-xs bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-charcoal font-medium">
                      {categoryName}
                    </span>
                  )}
                </div>
                <div className="p-2.5 sm:p-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-charcoal line-clamp-2 group-hover:text-primary-400 transition-colors">
                    {actTitle}
                  </h3>
                </div>
              </Link>
            );
          })}

          {/* "See all" card */}
          <Link
            href="/activities"
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-charcoal-lighter/20 hover:border-primary-400 transition-colors group min-h-[160px]"
          >
            <span className="text-3xl mb-2">→</span>
            <span className="text-sm font-medium text-charcoal-lighter group-hover:text-primary-400 transition-colors">
              {seeAllLabel}
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
