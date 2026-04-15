"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn, getTranslatedField } from "@/lib/utils";
import { CategoryPanel } from "./category-panel";
import { DatePanel } from "./date-panel";
import { PeoplePanel } from "./people-panel";
import { SearchOverlay } from "./search-overlay";
import type { Category } from "@/lib/types/database";

type Segment = "what" | "when" | "who" | null;

interface ExpandedSearchBarProps {
  categories: Category[];
  locale: string;
  initialCategoryIds?: string[];
  initialDateFrom?: string;
  initialDateTo?: string;
  initialPeople?: string;
  /**
   * Hydrated from the `anyDate=1` URL param. True means the user
   * explicitly picked "Qualquer data" — no date filter is active,
   * but the bar should render "Qualquer data" instead of the
   * placeholder.
   */
  initialAnyDate?: boolean;
}

export function ExpandedSearchBar({
  categories,
  locale,
  initialCategoryIds = [],
  initialDateFrom = "",
  initialDateTo = "",
  initialPeople = "",
  initialAnyDate = false,
}: ExpandedSearchBarProps) {
  const t = useTranslations("activities");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeSegment, setActiveSegment] = useState<Segment>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>(initialCategoryIds);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [anyDate, setAnyDate] = useState(initialAnyDate);
  const [people, setPeople] = useState<number>(
    initialPeople ? Math.max(0, parseInt(initialPeople) || 0) : 0
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  // Keep internal state in sync with URL changes from elsewhere
  // (e.g. the filter pill row below, back/forward nav). We only want
  // to overwrite local state when the URL actually changed — not
  // whenever the popover opens/closes. Track the last URL values we
  // observed and skip the sync when they're unchanged, so an
  // in-progress selection survives clicking outside the popover and
  // reopening it later.
  const lastSyncedUrlRef = useRef({
    category: searchParams.get("category") || "",
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
    anyDate: searchParams.get("anyDate") || "",
    minPeople: searchParams.get("minPeople") || "",
  });
  useEffect(() => {
    const cat = searchParams.get("category") || "";
    const df = searchParams.get("dateFrom") || "";
    const dt = searchParams.get("dateTo") || "";
    const ad = searchParams.get("anyDate") || "";
    const mp = searchParams.get("minPeople") || "";
    const last = lastSyncedUrlRef.current;
    if (
      cat === last.category &&
      df === last.dateFrom &&
      dt === last.dateTo &&
      ad === last.anyDate &&
      mp === last.minPeople
    ) {
      return;
    }
    lastSyncedUrlRef.current = {
      category: cat,
      dateFrom: df,
      dateTo: dt,
      anyDate: ad,
      minPeople: mp,
    };
    setCategoryIds(cat ? cat.split(",").filter(Boolean) : []);
    setDateFrom(df);
    setDateTo(dt);
    setAnyDate(ad === "1");
    setPeople(mp ? Math.max(0, parseInt(mp) || 0) : 0);
  }, [searchParams]);

  // Close any open desktop popover when the user clicks outside the bar
  // (including the popovers themselves) or hits Escape.
  const desktopBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeSegment) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (desktopBarRef.current && !desktopBarRef.current.contains(target)) {
        setActiveSegment(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveSegment(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [activeSegment]);

  function handleSearch() {
    // Merge into the current URL — don't rebuild from scratch. Other
    // UIs (ActivityFiltersPanel) write their own keys and we must
    // leave them untouched. Only set/delete keys owned by this bar.
    const params = new URLSearchParams(searchParams.toString());

    if (categoryIds.length > 0) params.set("category", categoryIds.join(","));
    else params.delete("category");

    if (dateFrom) params.set("dateFrom", dateFrom);
    else params.delete("dateFrom");

    if (dateTo) params.set("dateTo", dateTo);
    else params.delete("dateTo");

    // `anyDate=1` persists the "Qualquer data" choice so the bar
    // can render the label after navigation/refresh. It never
    // coexists with a concrete range — picking a date clears it.
    if (anyDate && !dateFrom && !dateTo) params.set("anyDate", "1");
    else params.delete("anyDate");

    if (people > 0) params.set("minPeople", String(people));
    else params.delete("minPeople");

    // Any filter change invalidates the current page position.
    params.delete("page");

    const qs = params.toString();
    router.push(`/activities${qs ? `?${qs}` : ""}` as "/activities");
    // Close any open popover (desktop) and the mobile overlay so the
    // user isn't still looking at a stepper/calendar after the search
    // commits. The URL-sync effect will re-sync local state now that
    // activeSegment is null.
    setActiveSegment(null);
    setMobileOpen(false);
  }

  function toggleSegment(seg: Segment) {
    setActiveSegment((prev) => (prev === seg ? null : seg));
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

  return (
    <>
      {/* Mobile search pill — single-line summary. All three
          selections (category, dates, people) are peer filters, so
          they render uniformly in bold charcoal separated by " · ".
          Earlier we styled category bolder than the tail, but that
          implied a hierarchy that isn't real — each segment is an
          equally-weighted user choice. The placeholder state keeps
          the lighter charcoal-lighter color so an empty pill still
          reads as a prompt. `truncate` protects against long
          Portuguese labels overflowing on narrow phones; the tail
          clips last, which is fine since most users won't scroll a
          pill to read it. */}
      {(() => {
        const hasCategory = categoryIds.length > 0;
        const tailParts = [
          dateFrom || anyDate ? dateLabel : null,
          people > 0 ? peopleLabel : null,
        ].filter(Boolean);
        return (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t("startSearch")}
            className="md:hidden w-full rounded-full border border-charcoal-lighter/20 bg-white px-4 py-2 shadow-card flex items-center gap-3 text-left transition-[padding] duration-200 [html[data-scrolled=true]_&]:py-1.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-400 text-white transition-all duration-200 [html[data-scrolled=true]_&]:h-7 [html[data-scrolled=true]_&]:w-7">
              <svg
                className="h-4 w-4 transition-all duration-200 [html[data-scrolled=true]_&]:h-3.5 [html[data-scrolled=true]_&]:w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 text-sm truncate font-semibold",
                hasCategory || tailParts.length > 0
                  ? "text-charcoal"
                  : "text-charcoal-lighter"
              )}
            >
              {hasCategory
                ? [categoryLabel, ...tailParts].join(" · ")
                : tailParts.length > 0
                  ? tailParts.join(" · ")
                  : t("startSearch")}
            </span>
          </button>
        );
      })()}

      {/* Mobile: Full-screen overlay */}
      <SearchOverlay
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        categories={categories}
        locale={locale}
        categoryIds={categoryIds}
        onCategoriesChange={setCategoryIds}
        dateFrom={dateFrom}
        dateTo={dateTo}
        anyDate={anyDate}
        onDateChange={(from, to, ad) => {
          setDateFrom(from);
          setDateTo(to);
          setAnyDate(!!ad);
        }}
        people={people}
        onPeopleChange={setPeople}
        onSearch={handleSearch}
      />

      {/* Desktop: Three-segment bar. Each segment button shrinks its
          vertical padding, and the small "What"/"When"/"Who" caption
          line collapses out entirely, when <html data-scrolled="true">
          (set by HeaderShell). That combination turns the tall
          two-line pill into a compact single-line bar — the biggest
          savings come from dropping the caption, not the padding. */}
      <div ref={desktopBarRef} className="hidden md:block relative">
        <div className={cn(
          "group mx-auto max-w-2xl rounded-full border border-charcoal-lighter/20 shadow-card flex items-stretch",
          activeSegment ? "bg-background-muted" : "bg-white"
        )}>
          {/* What segment */}
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => toggleSegment("what")}
              className={cn(
                "w-full text-left px-6 py-3 rounded-full transition-[padding] duration-200 [html[data-scrolled=true]_&]:py-2",
                activeSegment === "what" ? "bg-white shadow-card" : "hover:bg-background-muted/80"
              )}
            >
              <div className="text-xs font-semibold text-charcoal [html[data-scrolled=true]_&]:hidden">{t("searchWhat")}</div>
              <div className={cn("text-sm truncate", categoryIds.length > 0 ? "text-charcoal" : "text-charcoal-lighter")}>{categoryLabel}</div>
            </button>
            {activeSegment === "what" && (
              <div className="absolute left-0 top-full mt-3 z-40 bg-white rounded-xl shadow-dropdown border border-charcoal-lighter/10 p-5 w-[420px]">
                <CategoryPanel
                  categories={categories}
                  locale={locale}
                  selectedIds={categoryIds}
                  onToggle={(id) =>
                    setCategoryIds((prev) =>
                      prev.includes(id)
                        ? prev.filter((x) => x !== id)
                        : [...prev, id]
                    )
                  }
                  onSelectAll={() => setCategoryIds(categories.map((c) => c.id))}
                  onClear={() => setCategoryIds([])}
                />
              </div>
            )}
          </div>

          {activeSegment !== "what" && activeSegment !== "when" && (
            <div className="w-px bg-charcoal-lighter/20 my-2.5 transition-opacity group-hover:opacity-0" />
          )}

          {/* When segment */}
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => toggleSegment("when")}
              className={cn(
                "w-full text-left px-6 py-3 rounded-full transition-[padding] duration-200 [html[data-scrolled=true]_&]:py-2",
                activeSegment === "when" ? "bg-white shadow-card" : "hover:bg-background-muted/80"
              )}
            >
              <div className="text-xs font-semibold text-charcoal [html[data-scrolled=true]_&]:hidden">{t("searchWhen")}</div>
              <div className={cn("text-sm truncate", dateFrom || anyDate ? "text-charcoal" : "text-charcoal-lighter")}>{dateLabel}</div>
            </button>
            {activeSegment === "when" && (
              <div className="absolute left-0 top-full mt-3 z-40 bg-white rounded-xl shadow-dropdown border border-charcoal-lighter/10 p-5 w-[420px]">
                <DatePanel
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onChange={(from, to, ad) => {
                    setDateFrom(from);
                    setDateTo(to);
                    setAnyDate(!!ad);
                    // Advance to "who" once the date selection is complete.
                    // QuickDatePicks always sets both; the manual calendar
                    // sets `to` on the second click that closes the range.
                    // "Qualquer data" (ad=true) also counts as complete —
                    // it's an intentional selection, not an empty state.
                    if ((from && to) || ad) setActiveSegment("who");
                  }}
                />
              </div>
            )}
          </div>

          {activeSegment !== "when" && activeSegment !== "who" && (
            <div className="w-px bg-charcoal-lighter/20 my-2.5 transition-opacity group-hover:opacity-0" />
          )}

          {/* Who segment + search button wrapper (hover highlights the full pill) */}
          <div className={cn(
            "relative flex flex-1 items-stretch rounded-full transition-colors",
            activeSegment === "who"
              ? "bg-white shadow-card"
              : "hover:bg-background-muted/80"
          )}>
            <button
              type="button"
              onClick={() => toggleSegment("who")}
              className="flex-1 min-w-0 text-left px-6 py-3 rounded-full transition-[padding] duration-200 [html[data-scrolled=true]_&]:py-2"
            >
              <div className="text-xs font-semibold text-charcoal [html[data-scrolled=true]_&]:hidden">{t("searchWho")}</div>
              {/* Reserve width matching the placeholder so the pill never resizes when a number is picked. */}
              <div className="relative text-sm">
                <span className="invisible block truncate" aria-hidden>
                  {t("selectPeople")}
                </span>
                <span className={cn(
                  "absolute inset-0 truncate",
                  people > 0 ? "text-charcoal" : "text-charcoal-lighter"
                )}>
                  {peopleLabel}
                </span>
              </div>
            </button>
            {/* Search button — shrinks with the bar on scroll so it
                stays visually proportioned to the compact segments. */}
            <div className="flex items-center pr-2">
              <button
                type="button"
                onClick={handleSearch}
                className="rounded-full bg-primary-400 text-white p-3 hover:bg-primary-500 transition-all duration-200 flex items-center gap-1.5 [html[data-scrolled=true]_&]:p-2"
              >
                <svg className="h-4 w-4 transition-all duration-200 [html[data-scrolled=true]_&]:h-3.5 [html[data-scrolled=true]_&]:w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>

            {activeSegment === "who" && (
              <div className="absolute right-0 top-full mt-3 z-40 bg-white rounded-xl shadow-dropdown border border-charcoal-lighter/10 p-5 w-[360px]">
                <PeoplePanel people={people} onChange={setPeople} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
