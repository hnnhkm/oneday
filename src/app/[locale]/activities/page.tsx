import dynamic from "next/dynamic";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActivityGrid } from "@/components/activities/activity-grid";
import { ActivitySearchBar } from "@/components/activities/search/activity-search-bar";
import { ActivityFiltersPanel } from "@/components/activities/search/activity-filters-panel";
import { ViewToggle } from "@/components/activities/view-toggle";
import { ActivityCalendarView } from "@/components/activities/activity-calendar-view";
import { Pagination } from "@/components/ui/pagination";
import { SaveSearchButton } from "@/components/search/save-search-button";
import { getUser } from "@/lib/supabase/get-user";
import {
  fetchActivities,
  buildActivityQuery,
  fetchNeighborhoods,
  fetchFilterBounds,
} from "@/lib/queries/activities";
import { fetchCategories } from "@/lib/queries/categories";
import type { ActivitySort as SortType, TimeOfDay } from "@/lib/queries/activities";

const ActivityMap = dynamic(
  () =>
    import("@/components/activities/activity-map").then(
      (mod) => mod.ActivityMap
    ),
  { ssr: false }
);

interface BrowsePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    search?: string;
    category?: string;
    neighborhood?: string;
    minPrice?: string;
    maxPrice?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    page?: string;
    view?: string;
    calMonth?: string;
    timeOfDay?: string;
    durationMin?: string;
    durationMax?: string;
    minPeople?: string;
    maxPeople?: string;
  }>;
}

export default async function BrowseActivitiesPage({
  params: routeParams,
  searchParams,
}: BrowsePageProps) {
  const { locale } = await routeParams;
  setRequestLocale(locale);
  const params = await searchParams;
  const t = await getTranslations("activities");

  const [categories, neighborhoods, currentUser] = await Promise.all([
    fetchCategories(),
    fetchNeighborhoods(),
    getUser(),
  ]);

  const viewMode = params.view === "map" ? "map" : params.view === "calendar" ? "calendar" : "list";
  const isFullFetch = viewMode === "map" || viewMode === "calendar";
  const categoryIds = (params.category || "").split(",").filter(Boolean);
  const neighborhoodsParsed = (params.neighborhood || "")
    .split(",")
    .filter(Boolean);

  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth();
  if (params.calMonth && /^\d{4}-\d{2}$/.test(params.calMonth)) {
    const [y, m] = params.calMonth.split("-").map(Number);
    calYear = y;
    calMonth = m - 1;
  }

  const timeOfDayParsed = params.timeOfDay
    ? (params.timeOfDay.split(",").filter((s) =>
        ["morning", "afternoon", "evening"].includes(s)
      ) as TimeOfDay[])
    : undefined;

  const filters = buildActivityQuery({
    categoryIds,
    neighborhoods: neighborhoodsParsed,
    minPrice: params.minPrice ? parseInt(params.minPrice) * 100 : undefined,
    maxPrice: params.maxPrice ? parseInt(params.maxPrice) * 100 : undefined,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    search: params.search,
    sort: (params.sort as SortType) || (params.search ? "relevance" : "rating"),
    limit: isFullFetch ? 200 : 12,
    offset: isFullFetch ? 0 : params.page ? (parseInt(params.page) - 1) * 12 : 0,
    timeOfDay: timeOfDayParsed,
    durationMin: params.durationMin ? parseInt(params.durationMin) : undefined,
    durationMax: params.durationMax ? parseInt(params.durationMax) : undefined,
    minPeople: params.minPeople ? parseInt(params.minPeople) : undefined,
    maxPeople: params.maxPeople ? parseInt(params.maxPeople) : undefined,
  });

  const [{ data: activities, count }, bounds] = await Promise.all([
    fetchActivities(filters),
    fetchFilterBounds({
      status: "published",
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
      neighborhoods:
        neighborhoodsParsed.length > 0 ? neighborhoodsParsed : undefined,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      timeOfDay: timeOfDayParsed,
      // Slider-owned bounds are computed with that slider's own
      // params omitted so its range doesn't collapse to its value.
    }),
  ]);
  const perPage = 12;
  const currentPage = params.page ? parseInt(params.page) : 1;
  const totalPages = Math.ceil(count / perPage);

  const selectedDate =
    viewMode === "calendar" && params.dateFrom && params.dateFrom === params.dateTo
      ? params.dateFrom
      : undefined;

  return (
    <>
      {/* Sticky app chrome under the header — Airbnb-style. Groups the
          search bar and filter pill row in one translucent band that
          docks under the header via the `--header-h` CSS var (kept in
          sync by HeaderShell, even during its shrink transition). The
          outer wrapper spans full viewport width so the backdrop blur
          and bottom border read as app chrome, while an inner
          `max-w-6xl` div re-centers the content to match the rest of
          the page. `z-30` sits above page content but below the header
          (z-40) and modal overlays (z-60). */}
      <div className="sticky top-[var(--header-h)] z-30 bg-white/70 backdrop-blur-md border-b border-charcoal-lighter/10">
        <div className="mx-auto max-w-6xl px-4 py-3 space-y-3">
          <ActivitySearchBar categories={categories} locale={locale} />
          <ActivityFiltersPanel
            categories={categories}
            neighborhoods={neighborhoods}
            bounds={bounds}
            locale={locale}
          />
        </div>
      </div>

      {/* Non-sticky page content. `pt-6` matches the breathing room
          we'd lost from removing the outer `py-8`. */}
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <p className="text-sm text-charcoal-lighter">
          {t("resultsCount", { count })}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <SaveSearchButton isAuthed={!!currentUser} />
          <ViewToggle />
        </div>
      </div>

      {activities.length > 0 ? (
        viewMode === "map" ? (
          <ActivityMap activities={activities} locale={locale} />
        ) : viewMode === "calendar" ? (
          <>
            <ActivityCalendarView
              activities={activities}
              locale={locale}
              year={calYear}
              month={calMonth}
              selectedDate={selectedDate}
            />
            <ActivityGrid activities={activities} locale={locale} />
          </>
        ) : (
          <>
            <ActivityGrid activities={activities} locale={locale} />
            <Pagination currentPage={currentPage} totalPages={totalPages} />
          </>
        )
      ) : (
        <div className="text-center py-16">
          <p className="text-lg text-charcoal-lighter">
            {t("noActivities")}
          </p>
          <p className="text-sm text-charcoal-lighter mt-2">
            {t("noActivitiesDesc")}
          </p>
        </div>
      )}
      </div>
    </>
  );
}
