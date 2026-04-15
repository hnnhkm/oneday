"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface PeoplePanelProps {
  people: number;
  onChange: (next: number) => void;
  /**
   * Hide the inline "Quantas" title + description block. Used by the
   * mobile overlay where the enclosing card already has a large
   * "Quantas" heading — showing it twice read as repetition. Desktop
   * popover keeps the label since it has no outer header.
   */
  hideTitle?: boolean;
}

export function PeoplePanel({ people, onChange, hideTitle = false }: PeoplePanelProps) {
  const t = useTranslations("activities");
  const decrement = () => onChange(Math.max(0, people - 1));
  const increment = () => onChange(Math.min(99, people + 1));

  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-center gap-4",
          hideTitle ? "justify-end" : "justify-between"
        )}
      >
        {!hideTitle && (
          <div className="text-left">
            <div className="text-sm font-semibold text-charcoal">
              {t("searchWho")}
            </div>
            <div className="text-xs text-charcoal-lighter">
              {t("selectPeopleDescription")}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={decrement}
            disabled={people <= 0}
            aria-label="decrement"
            className={cn(
              "h-8 w-8 rounded-full border flex items-center justify-center transition-colors",
              people <= 0
                ? "border-charcoal-lighter/20 text-charcoal-lighter/40 cursor-not-allowed"
                : "border-charcoal-lighter/40 text-charcoal hover:border-charcoal"
            )}
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M4 10a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
            </svg>
          </button>
          <span className="min-w-[1.5rem] text-center text-sm font-medium text-charcoal tabular-nums">
            {people}
          </span>
          <button
            type="button"
            onClick={increment}
            aria-label="increment"
            className="h-8 w-8 rounded-full border border-charcoal-lighter/40 text-charcoal flex items-center justify-center hover:border-charcoal transition-colors"
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M11 5a1 1 0 10-2 0v4H5a1 1 0 100 2h4v4a1 1 0 102 0v-4h4a1 1 0 100-2h-4V5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
