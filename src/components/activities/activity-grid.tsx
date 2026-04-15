import { ActivityCard } from "./activity-card";
import { createClient } from "@/lib/supabase/server";
import { fetchFavoriteActivityIds } from "@/lib/queries/favorites";
import type { ActivityWithInstructor } from "@/lib/queries/activities";

interface ActivityGridProps {
  activities: ActivityWithInstructor[];
  locale: string;
}

export async function ActivityGrid({ activities, locale }: ActivityGridProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const favoritedIds = user ? await fetchFavoriteActivityIds(user.id) : new Set<string>();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          locale={locale}
          isFavorited={favoritedIds.has(activity.id)}
          isAuthed={!!user}
        />
      ))}
    </div>
  );
}
