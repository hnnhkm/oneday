import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActivityGrid } from "@/components/activities/activity-grid";
import { ActivitySearchBar } from "@/components/activities/search/activity-search-bar";
import { ActivityFiltersPanel } from "@/components/activities/search/activity-filters-panel";
import { ViewToggle } from "@/components/activities/view-toggle";
import { Pagination } from "@/components/ui/pagination";
import { SaveSearchButton } from "@/components/search/save-search-button";
import { getUser } from "@/lib/supabase/get-user";
import {
  fetchActivities,
  buildActivityQuery,
  fetchNeighborhoods,
  fetchFilterBounds,
} from "@/lib/queries/activities";
import { fetchCategories, fetchCategoryBySlug } from "@/lib/queries/categories";
import { getTranslatedField } from "@/lib/utils";
import type { ActivitySort as SortType, TimeOfDay } from "@/lib/queries/activities";
import type { TranslatedField } from "@/lib/types/database";

const ActivityMap = dynamic(
  () =>
    import("@/components/activities/activity-map").then(
      (mod) => mod.ActivityMap
    ),
  { ssr: false }
);

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>;
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
    timeOfDay?: string;
    durationMin?: string;
    durationMax?: string;
    minPeople?: string;
    maxPeople?: string;
  }>;
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const search = await searchParams;
  const t = await getTranslations();

  const category = await fetchCategoryBySlug(slug);
  if (!category) notFound();

  const [categories, neighborhoods, currentUser] = await Promise.all([
    fetchCategories(),
    fetchNeighborhoods(),
    getUser(),
  ]);

  const categoryName = getTranslatedField(
    category.name as unknown as TranslatedField,
    locale
  );

  const viewMode = search.view === "map" ? "map" : "list";
  const isFullFetch = viewMode === "map";

  const timeOfDayParsed = search.timeOfDay
    ? (search.timeOfDay.split(",").filter((s) =>
        ["morning", "afternoon", "evening"].includes(s)
      ) as TimeOfDay[])
    : undefined;

  const neighborhoodsParsed = (search.neighborhood || "")
    .split(",")
    .filter(Boolean);
  const extraCategoryIds = (search.category || "")
    .split(",")
    .filter(Boolean)
    .filter((id) => id !== category.id);
  const mergedCategoryIds = [category.id, ...extraCategoryIds];

  const filters = buildActivityQuery({
    categoryIds: mergedCategoryIds,
    neighborhoods: neighborhoodsParsed,
    minPrice: search.minPrice ? parseInt(search.minPrice) * 100 : undefined,
    maxPrice: search.maxPrice ? parseInt(search.maxPrice) * 100 : undefined,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    search: search.search,
    sort: (search.sort as SortType) || (search.search ? "relevance" : "rating"),
    limit: isFullFetch ? 200 : 12,
    offset: isFullFetch ? 0 : search.page ? (parseInt(search.page) - 1) * 12 : 0,
    timeOfDay: timeOfDayParsed,
    durationMin: search.durationMin ? parseInt(search.durationMin) : undefined,
    durationMax: search.durationMax ? parseInt(search.durationMax) : undefined,
    minPeople: search.minPeople ? parseInt(search.minPeople) : undefined,
    maxPeople: search.maxPeople ? parseInt(search.maxPeople) : undefined,
  });

  const [{ data: activities, count }, bounds] = await Promise.all([
    fetchActivities(filters),
    fetchFilterBounds({
      status: "published",
      categoryIds: mergedCategoryIds,
      neighborhoods:
        neighborhoodsParsed.length > 0 ? neighborhoodsParsed : undefined,
      dateFrom: search.dateFrom,
      dateTo: search.dateTo,
      timeOfDay: timeOfDayParsed,
    }),
  ]);
  const perPage = 12;
  const currentPage = search.page ? parseInt(search.page) : 1;
  const totalPages = Math.ceil(count / perPage);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">
          {t("category.activitiesIn", { category: categoryName })}
        </h1>
      </div>

      <ActivitySearchBar categories={categories} locale={locale} />

      <ActivityFiltersPanel
        categories={categories}
        neighborhoods={neighborhoods}
        bounds={bounds}
        locale={locale}
      />

      {/* Results info bar */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <p className="text-sm text-charcoal-lighter">
          {t("activities.resultsCount", { count })}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <SaveSearchButton isAuthed={!!currentUser} />
          <ViewToggle />
        </div>
      </div>

      {/* Content */}
      {activities.length > 0 ? (
        viewMode === "map" ? (
          <ActivityMap activities={activities} locale={locale} />
        ) : (
          <>
            <ActivityGrid activities={activities} locale={locale} />
            <Pagination currentPage={currentPage} totalPages={totalPages} />
          </>
        )
      ) : (
        <div className="text-center py-16">
          <p className="text-lg text-charcoal-lighter">
            {t("activities.noActivities")}
          </p>
          <p className="text-sm text-charcoal-lighter mt-2">
            {t("activities.noActivitiesDesc")}
          </p>
        </div>
      )}
    </div>
  );
}
