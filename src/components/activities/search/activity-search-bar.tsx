"use client";

import { useSearchParams } from "next/navigation";
import { ExpandedSearchBar } from "./expanded-search-bar";
import type { Category } from "@/lib/types/database";

interface ActivitySearchBarProps {
  categories: Category[];
  locale: string;
}

export function ActivitySearchBar({
  categories,
  locale,
}: ActivitySearchBarProps) {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "";
  const initialCategoryIds = category
    ? category.split(",").filter(Boolean)
    : [];

  return (
    <div>
      <ExpandedSearchBar
        categories={categories}
        locale={locale}
        initialCategoryIds={initialCategoryIds}
        initialDateFrom={searchParams.get("dateFrom") || ""}
        initialDateTo={searchParams.get("dateTo") || ""}
        initialAnyDate={searchParams.get("anyDate") === "1"}
        initialPeople={searchParams.get("minPeople") || ""}
      />
    </div>
  );
}
