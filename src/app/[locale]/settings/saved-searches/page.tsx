import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/supabase/get-user";
import { fetchUserSavedSearches } from "@/lib/queries/saved-searches";
import { formatCurrency } from "@/lib/utils";
import { DeleteSavedSearchButton } from "@/components/search/delete-saved-search-button";
import type { SavedSearch } from "@/lib/types/database";

export default async function SavedSearchesPage() {
  const locale = await getLocale();
  const t = await getTranslations("savedSearches");
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);

  const searches = await fetchUserSavedSearches(user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-charcoal">
          {t("pageTitle")}
        </h1>
        <Link
          href="/activities"
          className="text-sm text-primary-400 hover:underline"
        >
          {t("browseActivities")}
        </Link>
      </div>

      {searches.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-charcoal-lighter">{t("empty")}</p>
          <p className="text-sm text-charcoal-lighter mt-2">
            {t("emptyHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((s) => (
            <SavedSearchCard key={s.id} search={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedSearchCard({
  search,
}: {
  search: SavedSearch;
}) {
  const filters = search.filters;
  const chips: string[] = [];

  if (filters.search) chips.push(`"${filters.search}"`);
  if (filters.neighborhood) chips.push(filters.neighborhood);
  if (filters.minPrice != null || filters.maxPrice != null) {
    const min = filters.minPrice
      ? formatCurrency(filters.minPrice)
      : "";
    const max = filters.maxPrice
      ? formatCurrency(filters.maxPrice)
      : "";
    if (min && max) chips.push(`${min} – ${max}`);
    else if (min) chips.push(`${min}+`);
    else if (max) chips.push(`até ${max}`);
  }
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    chips.push(
      `${filters.categoryIds.length} ${filters.categoryIds.length === 1 ? "categoria" : "categorias"}`
    );
  }

  // Build a link to /activities with the saved filters as URL params.
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.neighborhood) params.set("neighborhood", filters.neighborhood);
  if (filters.minPrice != null)
    params.set("minPrice", String(Math.round(filters.minPrice / 100)));
  if (filters.maxPrice != null)
    params.set("maxPrice", String(Math.round(filters.maxPrice / 100)));
  if (filters.categoryIds && filters.categoryIds.length > 0)
    params.set("category", filters.categoryIds.join(","));
  const qs = params.toString();
  const href = `/activities${qs ? `?${qs}` : ""}`;

  return (
    <div className="rounded-lg bg-white shadow-card p-4 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <Link
          href={href as "/activities"}
          className="font-medium text-charcoal hover:text-primary-400 transition-colors"
        >
          {search.name}
        </Link>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="text-xs px-2 py-0.5 rounded-full bg-background-muted text-charcoal-lighter"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>
      <DeleteSavedSearchButton id={search.id} />
    </div>
  );
}
