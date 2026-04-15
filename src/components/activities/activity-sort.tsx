"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

export function ActivitySort() {
  const t = useTranslations("activities");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hasSearch = Boolean(searchParams.get("search")?.trim());
  const urlSort = searchParams.get("sort");
  const currentSort = urlSort || (hasSearch ? "relevance" : "rating");

  function handleSort(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sort);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-charcoal-lighter whitespace-nowrap">
        {t("sortBy")}
      </label>
      <select
        value={currentSort}
        onChange={(e) => handleSort(e.target.value)}
        className="rounded border border-charcoal-lighter/30 bg-white px-3 py-1.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
        {hasSearch && (
          <option value="relevance">{t("sortRelevance")}</option>
        )}
        <option value="rating">{t("sortRating")}</option>
        <option value="newest">{t("sortNewest")}</option>
        <option value="price_asc">{t("sortPriceAsc")}</option>
        <option value="price_desc">{t("sortPriceDesc")}</option>
      </select>
    </div>
  );
}
