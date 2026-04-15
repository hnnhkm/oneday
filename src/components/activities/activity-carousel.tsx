import { ActivityCard } from "./activity-card";
import { Carousel } from "@/components/ui/carousel";
import { createClient } from "@/lib/supabase/server";
import { fetchFavoriteActivityIds } from "@/lib/queries/favorites";
import type { ActivityWithInstructor } from "@/lib/queries/activities";

interface ActivityCarouselProps {
  activities: ActivityWithInstructor[];
  locale: string;
}

/**
 * Horizontal snap-scroll carousel of ActivityCards. Server component
 * that resolves user auth + favorites, then renders each card inside
 * the client-side Carousel wrapper.
 *
 * Each card is fixed-width (w-72 on mobile, w-80 on sm+) and
 * flex-shrink-0 so the carousel scrolls rather than wraps.
 */
export async function ActivityCarousel({
  activities,
  locale,
}: ActivityCarouselProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const favoritedIds = user
    ? await fetchFavoriteActivityIds(user.id)
    : new Set<string>();

  return (
    <Carousel>
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="w-72 sm:w-80 flex-shrink-0 snap-start"
        >
          <ActivityCard
            activity={activity}
            locale={locale}
            isFavorited={favoritedIds.has(activity.id)}
            isAuthed={!!user}
          />
        </div>
      ))}
    </Carousel>
  );
}
