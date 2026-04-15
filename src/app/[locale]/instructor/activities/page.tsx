import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityRowActions } from "@/components/instructor/activity-row-actions";
import { requireApprovedInstructor } from "@/lib/supabase/require-approved-instructor";
import { fetchMyActivities } from "@/lib/queries/instructor";
import { createClient } from "@/lib/supabase/server";
import {
  formatDate,
  formatTime,
  getTranslatedField,
  cn,
} from "@/lib/utils";
import type { Activity, TranslatedField } from "@/lib/types/database";

type Tab = "all" | "drafts" | "published" | "past" | "cancelled";
const TABS: Tab[] = ["all", "drafts", "published", "past", "cancelled"];

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function MyActivitiesPage({ searchParams }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("instructor.activitiesList");
  const { profile } = await requireApprovedInstructor();
  const params = await searchParams;
  const activeTab: Tab = (TABS as string[]).includes(params.tab || "")
    ? (params.tab as Tab)
    : "all";

  const all = await fetchMyActivities(profile.id);

  // Fetch booking counts for every activity so we can show seat fill and
  // drive the delete/unpublish affordances. One roundtrip using RLS.
  const supabase = await createClient();
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("activity_id, seats_booked, status")
    .in("activity_id", all.map((a) => a.id));

  const bookingCountByActivity = new Map<string, number>();
  const seatsBookedByActivity = new Map<string, number>();
  for (const b of (bookingRows as Array<{
    activity_id: string;
    seats_booked: number;
    status: string;
  }>) || []) {
    if (b.status === "cancelled") continue;
    bookingCountByActivity.set(
      b.activity_id,
      (bookingCountByActivity.get(b.activity_id) || 0) + 1
    );
    seatsBookedByActivity.set(
      b.activity_id,
      (seatsBookedByActivity.get(b.activity_id) || 0) + b.seats_booked
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const visible = all.filter((a) => categorize(a, today) === activeTab || activeTab === "all");

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-charcoal">
          {t("title")}
        </h1>
        <Link href="/instructor/activities/new">
          <Button>+ {t("emptyCta")}</Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-charcoal-lighter/10 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={
              `/instructor/activities?tab=${tab}` as "/instructor/activities"
            }
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              activeTab === tab
                ? "border-primary-400 text-primary-400"
                : "border-transparent text-charcoal-lighter hover:text-charcoal"
            )}
          >
            {t(
              ("tab" + tab.charAt(0).toUpperCase() + tab.slice(1)) as
                | "tabAll"
                | "tabDrafts"
                | "tabPublished"
                | "tabPast"
                | "tabCancelled"
            )}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎨</div>
          <p className="text-charcoal-lighter mb-6">{t("empty")}</p>
          <Link href="/instructor/activities/new">
            <Button>{t("emptyCta")}</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((a) => {
            const booked = seatsBookedByActivity.get(a.id) || 0;
            const bookingCount = bookingCountByActivity.get(a.id) || 0;
            const statusLabel = statusLabelKey(a, today);
            return (
              <article
                key={a.id}
                className="relative flex flex-col sm:flex-row gap-4 bg-white rounded-lg shadow-card overflow-visible"
              >
                <div className="relative w-full sm:w-48 aspect-[4/3] sm:aspect-auto flex-shrink-0 bg-background-muted rounded-t-lg sm:rounded-l-lg sm:rounded-tr-none overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.cover_image_url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>

                {/* Three-dot menu — top right of card */}
                <div className="absolute top-2 right-2 z-10">
                  <ActivityRowActions
                    activityId={a.id}
                    status={a.status}
                    date={a.date}
                    today={today}
                    bookingCount={bookingCount}
                  />
                </div>

                <div className="flex-1 p-4 sm:py-4 sm:pr-10 sm:pl-0 flex flex-col">
                  <div className="flex items-start gap-2 mb-1 pr-8">
                    <h3 className="font-semibold text-charcoal line-clamp-2">
                      {getTranslatedField(
                        a.title as TranslatedField,
                        locale
                      )}
                    </h3>
                    <Badge className="flex-shrink-0">
                      {t(statusLabel)}
                    </Badge>
                  </div>
                  <div className="text-sm text-charcoal-lighter space-y-0.5">
                    <p>
                      📅 {formatDate(a.date, locale)} · {formatTime(a.time)}
                    </p>
                    <p>
                      📍 {a.neighborhood}, {a.city}
                    </p>
                    <p>
                      🎟️{" "}
                      {t("seatsBooked", {
                        booked,
                        total: a.max_seats,
                      })}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function categorize(a: Activity, today: string): Tab {
  if (a.status === "cancelled") return "cancelled";
  if (a.status === "draft") return "drafts";
  if (a.date < today || a.status === "completed") return "past";
  return "published";
}

function statusLabelKey(
  a: Activity,
  today: string
):
  | "statusDraft"
  | "statusPublished"
  | "statusCancelled"
  | "statusCompleted" {
  if (a.status === "draft") return "statusDraft";
  if (a.status === "cancelled") return "statusCancelled";
  if (a.status === "completed" || a.date < today) return "statusCompleted";
  return "statusPublished";
}
