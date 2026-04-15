"use client";

import { useTranslations } from "next-intl";
import { cn, getTranslatedField } from "@/lib/utils";
import type { Category } from "@/lib/types/database";

interface CategoryPanelProps {
  categories: Category[];
  locale: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

export function CategoryPanel({
  categories,
  locale,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
}: CategoryPanelProps) {
  const t = useTranslations("activities");

  // Stable alphabetical order by localized name. Computed here so the
  // caller doesn't have to pre-sort; categories is a small list (tens).
  const sorted = [...categories].sort((a, b) => {
    const an = getTranslatedField(a.name, locale);
    const bn = getTranslatedField(b.name, locale);
    return an.localeCompare(bn);
  });

  return (
    <div className="w-full">
      {/* Header links: Select all / Clear */}
      <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-charcoal-lighter/10">
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs font-medium text-charcoal underline underline-offset-2 hover:text-charcoal-lighter"
        >
          {t("selectAll")}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-charcoal underline underline-offset-2 hover:text-charcoal-lighter"
        >
          {t("clear")}
        </button>
      </div>

      {/* Pill chips — same treatment as the Categoria section in the
          More Filters modal so the two surfaces feel consistent.
          `flex flex-wrap` lets the chips lay out on as many rows as
          the panel width allows, with vertical scroll as a fallback
          when the taxonomy overflows the dropdown height. */}
      <div role="group" aria-label={t("searchWhat")}>
        <div className="flex flex-wrap gap-2 max-h-[320px] overflow-y-auto px-1 pt-1">
          {sorted.map((cat) => {
            const active = selectedIds.includes(cat.id);
            const name = getTranslatedField(cat.name, locale);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onToggle(cat.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs sm:px-3 sm:text-sm transition-colors",
                  active
                    ? "border-charcoal bg-charcoal text-white font-medium"
                    : "border-charcoal-lighter/30 text-charcoal hover:border-charcoal-lighter/60"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
