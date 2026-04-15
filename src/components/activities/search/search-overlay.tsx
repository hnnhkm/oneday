"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { cn, getTranslatedField } from "@/lib/utils";
import { CategoryPanel } from "./category-panel";
import { DatePanel } from "./date-panel";
import { PeoplePanel } from "./people-panel";
import type { Category } from "@/lib/types/database";

type Card = "what" | "when" | "who" | null;

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  locale: string;
  categoryIds: string[];
  onCategoriesChange: (ids: string[]) => void;
  dateFrom: string;
  dateTo: string;
  anyDate: boolean;
  /**
   * Third arg `anyDate` is true when the user explicitly picks
   * "Qualquer data" — both dates are empty strings but the choice
   * is intentional, so the bar should render "Qualquer data"
   * rather than the placeholder.
   */
  onDateChange: (from: string, to: string, anyDate?: boolean) => void;
  people: number;
  onPeopleChange: (next: number) => void;
  onSearch: () => void;
}

export function SearchOverlay({
  open,
  onClose,
  categories,
  locale,
  categoryIds,
  onCategoriesChange,
  dateFrom,
  dateTo,
  anyDate,
  onDateChange,
  people,
  onPeopleChange,
  onSearch,
}: SearchOverlayProps) {
  const t = useTranslations("activities");
  const [expandedCard, setExpandedCard] = useState<Card>("what");
  // Portaling to <body> so the overlay escapes the page's sticky
  // chrome wrapper (which sits inside a z-30 stacking context). Left
  // in-tree, `z-[60]` on this overlay was being compared as a child
  // of z-30 vs. the z-40 MobileNav at body level, and losing — which
  // clipped the overlay's footer (including "Mostrar resultados")
  // behind the bottom nav. Portaling lifts the overlay into the root
  // stacking context so its z-[60] actually applies globally.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      // Lock BOTH <html> and <body> — on iOS Safari, `overflow:hidden`
      // on body alone doesn't stop momentum scroll from rubber-banding
      // the underlying page. Locking html too reliably freezes the
      // background while the overlay is up.
      const prevHtml = document.documentElement.style.overflow;
      const prevBody = document.body.style.overflow;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      setExpandedCard("what");
      return () => {
        document.documentElement.style.overflow = prevHtml;
        document.body.style.overflow = prevBody;
      };
    }
  }, [open]);

  if (!open || !mounted) return null;

  function handleClear() {
    onCategoriesChange([]);
    // Pass anyDate=false explicitly so "Clear all" also resets the
    // "Qualquer data" choice — otherwise the bar would still label
    // the date segment as "Qualquer data" after clearing.
    onDateChange("", "", false);
    onPeopleChange(0);
  }

  const categoryLabel =
    categoryIds.length === 0
      ? t("selectActivity")
      : categoryIds.length === 1
        ? (() => {
            const cat = categories.find((c) => c.id === categoryIds[0]);
            if (!cat) return t("categoriesCount", { count: 1 });
            return getTranslatedField(cat.name, locale);
          })()
        : t("categoriesCount", { count: categoryIds.length });

  const dateLabel = dateFrom
    ? dateTo && dateTo !== dateFrom
      ? `${new Date(dateFrom + "T12:00").toLocaleDateString("en", { month: "short", day: "numeric" })} – ${new Date(dateTo + "T12:00").toLocaleDateString("en", { month: "short", day: "numeric" })}`
      : new Date(dateFrom + "T12:00").toLocaleDateString("en", { month: "short", day: "numeric" })
    : anyDate
      ? t("anytime")
      : t("addDates");
  const peopleLabel = people > 0
    ? t("peopleCount", { count: people })
    : t("selectPeople");

  const content = (
    // `h-[100dvh]` rather than relying on `inset-0`/`100vh` so iOS Safari
    // doesn't let the footer slide under the dynamic URL bar. `w-screen`
    // + `overflow-x-hidden` clamps the overlay to the visual viewport
    // width and clips any child that would otherwise make the overlay
    // itself scrollable sideways (body-level overflow-x-hidden doesn't
    // apply to fixed positioning — fixed elements are sized against the
    // viewport and get their own scroll context). `z-[60]` keeps it
    // above the mobile bottom nav (z-40) — see the portal note above
    // for why this only works once the overlay is hoisted to <body>.
    <div className="fixed inset-0 z-[60] bg-background flex flex-col h-[100dvh] w-screen overflow-x-hidden overscroll-none">
      {/* Header */}
      <div className="mx-auto w-full max-w-md flex items-center justify-end px-4 py-3">
        <button type="button" onClick={onClose} className="rounded-full p-1.5 border border-charcoal-lighter/20">
          <svg className="h-4 w-4 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stacked cards — scrollable middle. `min-h-0` is required on
          flex children that contain `overflow-y-auto`, otherwise the
          parent collapses to the content's intrinsic height and the
          footer gets pushed below the viewport. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-4 space-y-3 pb-4">
        {/* What card — header is always a <button>, so tapping it
            opens the card when collapsed and closes it when expanded.
            When expanded the panel body renders as a sibling (NOT
            nested inside the button) because the panel itself contains
            interactive controls and nested buttons would be invalid
            HTML and break taps. */}
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandedCard(expandedCard === "what" ? null : "what")}
            aria-expanded={expandedCard === "what"}
            className="w-full text-left px-5 py-4 flex justify-between items-center"
          >
            {expandedCard === "what" ? (
              <h3 className="text-lg font-semibold text-charcoal">
                {t("searchWhat")}?
              </h3>
            ) : (
              <>
                <span className="text-sm text-charcoal-lighter">{t("searchWhat")}</span>
                <span className="text-sm font-medium text-charcoal">{categoryLabel}</span>
              </>
            )}
            <Chevron open={expandedCard === "what"} hiddenWhenCollapsed />
          </button>
          {expandedCard === "what" && (
            <div className="px-5 pb-5">
              <CategoryPanel
                categories={categories}
                locale={locale}
                selectedIds={categoryIds}
                onToggle={(id) =>
                  onCategoriesChange(
                    categoryIds.includes(id)
                      ? categoryIds.filter((x) => x !== id)
                      : [...categoryIds, id]
                  )
                }
                onSelectAll={() => onCategoriesChange(categories.map((c) => c.id))}
                onClear={() => onCategoriesChange([])}
              />
            </div>
          )}
        </div>

        {/* When card */}
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandedCard(expandedCard === "when" ? null : "when")}
            aria-expanded={expandedCard === "when"}
            className="w-full text-left px-5 py-4 flex justify-between items-center"
          >
            {expandedCard === "when" ? (
              <h3 className="text-lg font-semibold text-charcoal">
                {t("searchWhen")}?
              </h3>
            ) : (
              <>
                <span className="text-sm text-charcoal-lighter">{t("searchWhen")}</span>
                <span className="text-sm font-medium text-charcoal">{dateLabel}</span>
              </>
            )}
            <Chevron open={expandedCard === "when"} hiddenWhenCollapsed />
          </button>
          {expandedCard === "when" && (
            <div className="px-5 pb-5">
              <DatePanel dateFrom={dateFrom} dateTo={dateTo} onChange={onDateChange} />
            </div>
          )}
        </div>

        {/* Who card — same toggle pattern as what/when, with the
            stepper pinned into the header row on the right when
            expanded. Tapping anywhere on the row (including the gap
            between text and stepper) collapses the card; the +/-
            buttons themselves stay independent via a stopPropagation
            wrapper. We can't use a `<button>` for the whole row
            because that would nest the stepper's buttons — invalid
            HTML and broken taps — so a `role="button"` div handles
            click + keyboard. */}
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          {expandedCard === "who" ? (
            <div
              role="button"
              tabIndex={0}
              aria-expanded="true"
              onClick={() => setExpandedCard(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedCard(null);
                }
              }}
              className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer"
            >
              <div className="min-w-0 text-left flex-1">
                <h3 className="text-lg font-semibold text-charcoal">
                  {t("searchWho")}
                </h3>
                <p className="text-xs text-charcoal-lighter">
                  {t("selectPeopleDescription")}
                </p>
              </div>
              {/* stopPropagation so tapping -/+ doesn't also bubble
                  up to the row's collapse handler. */}
              <div onClick={(e) => e.stopPropagation()}>
                <PeoplePanel people={people} onChange={onPeopleChange} hideTitle />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpandedCard("who")}
              aria-expanded="false"
              className="w-full text-left px-5 py-4 flex justify-between items-center"
            >
              <span className="text-sm text-charcoal-lighter">{t("searchWho")}</span>
              <span className="text-sm font-medium text-charcoal">{peopleLabel}</span>
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Footer — lives outside the scroll area so it's always visible.
          The outer band spans full width (border + bg feel intentional
          edge-to-edge), the inner row re-centers with max-w-md to match
          the card column above. */}
      <div className="border-t border-charcoal-lighter/10 bg-white">
        <div className="mx-auto w-full max-w-md px-5 py-4 flex items-center justify-between">
          <button type="button" onClick={handleClear} className="text-sm font-medium text-charcoal underline underline-offset-2">
            {t("clearAll")}
          </button>
          <button
            type="button"
            onClick={onSearch}
            className="rounded-xl bg-primary-400 text-white px-6 py-3 text-sm font-medium hover:bg-primary-500 transition-colors flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {t("showResults")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Tiny chevron that flips when its card opens — signals that the
 * header is tappable to toggle. Hidden on the collapsed state for
 * the "what"/"when" cards because the right column already shows
 * a summary value there and a chevron would crowd it; the open
 * state has just the heading on the left, so the chevron has room.
 */
function Chevron({
  open,
  hiddenWhenCollapsed = false,
}: {
  open: boolean;
  hiddenWhenCollapsed?: boolean;
}) {
  if (!open && hiddenWhenCollapsed) return null;
  return (
    <svg
      className={cn(
        "h-4 w-4 shrink-0 text-charcoal-lighter transition-transform",
        open && "rotate-180"
      )}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
