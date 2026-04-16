"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <Select value={currentSort} onValueChange={handleSort}>
        <SelectTrigger className="w-auto py-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {hasSearch && (
            <SelectItem value="relevance">{t("sortRelevance")}</SelectItem>
          )}
          <SelectItem value="rating">{t("sortRating")}</SelectItem>
          <SelectItem value="newest">{t("sortNewest")}</SelectItem>
          <SelectItem value="price_asc">{t("sortPriceAsc")}</SelectItem>
          <SelectItem value="price_desc">{t("sortPriceDesc")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
