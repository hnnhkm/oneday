import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { FavoriteButton } from "./favorite-button";
import {
  formatCurrency,
  formatDurationHours,
  getTranslatedField,
} from "@/lib/utils";
import type { ActivityWithInstructor } from "@/lib/queries/activities";
import type { TranslatedField } from "@/lib/types/database";

interface ActivityCardProps {
  activity: ActivityWithInstructor;
  locale: string;
  isFavorited?: boolean;
  isAuthed?: boolean;
}

export function ActivityCard({
  activity,
  locale,
  isFavorited = false,
  isAuthed = false,
}: ActivityCardProps) {
  const title = getTranslatedField(activity.title as TranslatedField, locale);
  const categoryName = getTranslatedField(
    activity.categories.name as unknown as TranslatedField,
    locale
  );
  const isSoldOut = activity.seats_remaining === 0;

  // No date/time on the card. With multi-session activities, any
  // single date/time is misleading — it's just one of several options
  // and the user hasn't picked one yet. The detail page owns "when"
  // via the session picker. What stays on the card: neighborhood
  // (real discriminator), duration (activity-level, not session-level),
  // price, and scarcity.

  return (
    <Link href={`/activities/${activity.id}`}>
      <Card className="overflow-hidden group cursor-pointer h-full flex flex-col">
        {/* Cover image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={activity.cover_image_url}
            alt={title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {/* Favorite button — ghost variant: outline heart only, no
              backing pill, so the image stays the hero of the card. */}
          <div className="absolute top-2 right-2">
            <FavoriteButton
              activityId={activity.id}
              initialFavorited={isFavorited}
              requiresAuth={!isAuthed}
              size="sm"
              variant="ghost"
            />
          </div>
          {/* Sold out overlay */}
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white font-bold text-lg">Esgotado</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-2.5 sm:p-4 flex flex-col flex-1">
          {/* Category — ahead of the title so the activity itself reads
              as the headline. `text-[11px]` sits on the caption tier of
              the shared type scale (see filter surface). */}
          <div className="mb-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-charcoal-lighter sm:text-xs">
              <span aria-hidden>{activity.categories.icon}</span>
              {categoryName}
            </span>
          </div>
          {/* Title — reserve 2 lines of height even for 1-line titles
              so every row below (neighborhood, duration, price) sits
              at the same y-coordinate across cards in the grid. */}
          <h3 className="text-sm sm:text-base font-semibold text-charcoal line-clamp-2 min-h-[2lh] mb-1 sm:mb-2">
            {title}
          </h3>

          {/* Mobile: neighborhood only — keeps the card tight. */}
          <p className="sm:hidden text-[11px] text-charcoal-lighter">
            📍 {activity.neighborhood}
          </p>

          {/* Desktop: neighborhood + duration. No date/time — see note
              above the return statement for why. */}
          <div className="hidden sm:block text-xs text-charcoal-lighter space-y-0.5">
            <p>📍 {activity.neighborhood}</p>
            <p>⏱ {formatDurationHours(activity.duration_minutes)}</p>
          </div>

          {/* Bottom row: price + scarcity badge. `mt-auto` pins this to
              the bottom of the card so cards with shorter titles don't
              leave the price floating halfway up. The seat count only
              renders when fewer than 5 remain — at that point it's
              useful urgency. Above that, it was noise. */}
          <div className="flex items-baseline justify-between mt-auto sm:pt-2">
            <span className="text-sm sm:text-lg font-bold text-primary-400">
              {formatCurrency(activity.price_cents)}
            </span>
            {!isSoldOut && activity.seats_remaining < 5 && (
              <span className="text-[11px] font-medium text-accent-600 sm:text-xs whitespace-nowrap">
                {activity.seats_remaining} vagas
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

