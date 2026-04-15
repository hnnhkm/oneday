"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTranslatedField } from "@/lib/utils";
import type { Category, TranslatedField } from "@/lib/types/database";

interface ActivityFiltersProps {
  categories: Category[];
  neighborhoods: string[];
  locale: string;
}

export function ActivityFilters({
  categories,
  neighborhoods,
  locale,
}: ActivityFiltersProps) {
  const t = useTranslations("activities");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialCategoryIds = (searchParams.get("category") || "")
    .split(",")
    .filter(Boolean);

  const [categoryIds, setCategoryIds] = useState<string[]>(initialCategoryIds);
  const [neighborhood, setNeighborhood] = useState(
    searchParams.get("neighborhood") || ""
  );
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node)
      ) {
        setCategoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleCategory(id: string) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function applyFilters() {
    const params = new URLSearchParams();

    const search = searchParams.get("search");
    if (search) params.set("search", search);

    if (categoryIds.length > 0) params.set("category", categoryIds.join(","));
    if (neighborhood) params.set("neighborhood", neighborhood);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ""}`);
  }

  function clearFilters() {
    setCategoryIds([]);
    setNeighborhood("");
    setMinPrice("");
    setMaxPrice("");
    setDateFrom("");
    setDateTo("");

    const search = searchParams.get("search");
    if (search) {
      router.push(`${pathname}?search=${search}`);
    } else {
      router.push(pathname);
    }
  }

  const categoryButtonLabel =
    categoryIds.length === 0
      ? t("allCategories")
      : categoryIds.length === 1
      ? getTranslatedField(
          categories.find((c) => c.id === categoryIds[0])?.name as unknown as TranslatedField,
          locale
        )
      : `${categoryIds.length} ${t("filters").toLowerCase()}`;

  return (
    <div className="bg-white rounded-lg shadow-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Categories multi-select */}
        <div className="relative flex-1 min-w-[180px]" ref={categoryDropdownRef}>
          <label className="block text-xs font-medium text-charcoal-lighter mb-1">
            {t("allCategories")}
          </label>
          <button
            type="button"
            onClick={() => setCategoryDropdownOpen((o) => !o)}
            className="w-full rounded border border-charcoal-lighter/30 bg-white px-3 py-2 text-sm text-charcoal text-left focus:outline-none focus:ring-2 focus:ring-primary-400 truncate"
          >
            {categoryButtonLabel}
          </button>
          {categoryDropdownOpen && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-charcoal-lighter/20 max-h-72 overflow-y-auto">
              {categories.map((cat) => {
                const checked = categoryIds.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-primary-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(cat.id)}
                      className="h-4 w-4 accent-primary-400"
                    />
                    <span>
                      {cat.icon}{" "}
                      {getTranslatedField(
                        cat.name as unknown as TranslatedField,
                        locale
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Neighborhood */}
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-charcoal-lighter mb-1">
            {t("neighborhood")}
          </label>
          <select
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            className="w-full rounded border border-charcoal-lighter/30 bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">{t("allNeighborhoods")}</option>
            {neighborhoods.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Price range */}
        <div className="flex-1 w-full sm:w-auto sm:min-w-[180px]">
          <label className="block text-xs font-medium text-charcoal-lighter mb-1">
            {t("priceRange")}
          </label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t("minPrice")}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="text-sm min-w-0"
            />
            <Input
              type="number"
              placeholder={t("maxPrice")}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="text-sm min-w-0"
            />
          </div>
        </div>

        {/* Date range */}
        <div className="flex-1 w-full sm:w-auto sm:min-w-[230px]">
          <label className="block text-xs font-medium text-charcoal-lighter mb-1">
            {t("dateRange")}
          </label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm min-w-0 max-w-[150px]"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm min-w-0 max-w-[150px]"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 items-end">
          <Button onClick={applyFilters} size="sm">
            {t("filters")}
          </Button>
          <Button onClick={clearFilters} variant="ghost" size="sm">
            {t("clearFilters")}
          </Button>
        </div>
      </div>
    </div>
  );
}
