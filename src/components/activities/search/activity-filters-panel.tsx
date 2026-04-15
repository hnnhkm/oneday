"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { getTranslatedField, cn, formatDurationHours } from "@/lib/utils";
import { RangeSlider } from "@/components/ui/range-slider";
import type { Category, TranslatedField } from "@/lib/types/database";
import type { FilterBounds } from "@/lib/queries/activities";

type PopoverKind = "category" | "neighborhood" | "sort" | "timeOfDay" | null;
type TimeSlot = "morning" | "afternoon" | "evening";
type SortKey = "rating" | "newest" | "price_asc" | "price_desc" | "relevance";

const TIME_SLOTS: TimeSlot[] = ["morning", "afternoon", "evening"];
const SORT_KEYS: SortKey[] = ["rating", "newest", "price_asc", "price_desc"];

interface ActivityFiltersPanelProps {
  categories: Category[];
  neighborhoods: string[];
  bounds: FilterBounds;
  locale: string;
}

export function ActivityFiltersPanel({
  categories,
  neighborhoods,
  bounds,
  locale,
}: ActivityFiltersPanelProps) {
  const t = useTranslations("activities");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [open, setOpen] = useState<PopoverKind>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Anchors for the portal-based Popover — each pill wrapper gets a
  // ref so Popover can position itself against the pill even when its
  // DOM home (document.body) is far from the pill in the tree.
  const categoryAnchorRef = useRef<HTMLDivElement | null>(null);
  const neighborhoodAnchorRef = useRef<HTMLDivElement | null>(null);
  const timeOfDayAnchorRef = useRef<HTMLDivElement | null>(null);
  const sortAnchorRef = useRef<HTMLDivElement | null>(null);

  // Close popover / modal on Escape.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setModalOpen(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---------- URL-derived state ----------
  const selectedCategoryIds = useMemo(
    () => (searchParams.get("category") || "").split(",").filter(Boolean),
    [searchParams]
  );
  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => {
        const nameA = getTranslatedField(
          a.name as unknown as TranslatedField,
          locale
        );
        const nameB = getTranslatedField(
          b.name as unknown as TranslatedField,
          locale
        );
        return nameA.localeCompare(nameB, locale);
      }),
    [categories, locale]
  );
  const selectedNeighborhoods = useMemo(
    () =>
      (searchParams.get("neighborhood") || "").split(",").filter(Boolean),
    [searchParams]
  );
  const hasSearch = !!searchParams.get("search");
  const selectedSort = (searchParams.get("sort") ||
    (hasSearch ? "relevance" : "rating")) as SortKey;
  const selectedTimeOfDay = useMemo(
    () =>
      (searchParams.get("timeOfDay") || "")
        .split(",")
        .filter(Boolean) as TimeSlot[],
    [searchParams]
  );

  const qMinPrice = searchParams.get("minPrice");
  const qMaxPrice = searchParams.get("maxPrice");
  const qDurMin = searchParams.get("durationMin");
  const qDurMax = searchParams.get("durationMax");
  const qPplMin = searchParams.get("minPeople");
  const qPplMax = searchParams.get("maxPeople");

  // ---------- Draft state (committed on "Show results") ----------
  const [draftCategoryIds, setDraftCategoryIds] =
    useState<string[]>(selectedCategoryIds);
  const [draftNeighborhoods, setDraftNeighborhoods] =
    useState<string[]>(selectedNeighborhoods);
  const [draftTimeOfDay, setDraftTimeOfDay] =
    useState<TimeSlot[]>(selectedTimeOfDay);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    qMinPrice ? parseInt(qMinPrice) : bounds.priceMin,
    qMaxPrice ? parseInt(qMaxPrice) : bounds.priceMax,
  ]);
  const [durationRange, setDurationRange] = useState<[number, number]>([
    qDurMin ? parseInt(qDurMin) : bounds.durationMin,
    qDurMax ? parseInt(qDurMax) : bounds.durationMax,
  ]);
  const [peopleRange, setPeopleRange] = useState<[number, number]>([
    qPplMin ? parseInt(qPplMin) : bounds.peopleMin,
    qPplMax ? parseInt(qPplMax) : bounds.peopleMax,
  ]);

  // Resync drafts when popovers/modal open.
  useEffect(() => {
    if (open === "category") setDraftCategoryIds(selectedCategoryIds);
    if (open === "neighborhood") setDraftNeighborhoods(selectedNeighborhoods);
    if (open === "timeOfDay") setDraftTimeOfDay(selectedTimeOfDay);
  }, [open, selectedCategoryIds, selectedNeighborhoods, selectedTimeOfDay]);

  useEffect(() => {
    if (!modalOpen) return;
    // Modal owns every filter, so resync all drafts from URL on open.
    setDraftCategoryIds(selectedCategoryIds);
    setDraftNeighborhoods(selectedNeighborhoods);
    setDraftTimeOfDay(selectedTimeOfDay);
    setPriceRange([
      qMinPrice ? parseInt(qMinPrice) : bounds.priceMin,
      qMaxPrice ? parseInt(qMaxPrice) : bounds.priceMax,
    ]);
    setDurationRange([
      qDurMin ? parseInt(qDurMin) : bounds.durationMin,
      qDurMax ? parseInt(qDurMax) : bounds.durationMax,
    ]);
    setPeopleRange([
      qPplMin ? parseInt(qPplMin) : bounds.peopleMin,
      qPplMax ? parseInt(qPplMax) : bounds.peopleMax,
    ]);
  }, [
    modalOpen,
    selectedCategoryIds,
    selectedNeighborhoods,
    selectedTimeOfDay,
    qMinPrice,
    qMaxPrice,
    qDurMin,
    qDurMax,
    qPplMin,
    qPplMax,
    bounds,
  ]);

  // ---------- URL writer ----------
  function pushUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(overrides)) {
      if (val === undefined || val === "") params.delete(key);
      else params.set(key, val);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push((qs ? `${pathname}?${qs}` : pathname) as "/activities");
    });
  }

  // ---------- Labels ----------
  const catLabel =
    selectedCategoryIds.length > 0
      ? `${t("categoryLabel")} · ${selectedCategoryIds.length}`
      : t("categoryLabel");
  const nbhdLabel =
    selectedNeighborhoods.length > 0
      ? `${t("neighborhood")} · ${selectedNeighborhoods.length}`
      : t("neighborhood");
  const sortLabelMap: Record<SortKey, string> = {
    rating: t("sortRating"),
    newest: t("sortNewest"),
    price_asc: t("sortPriceAsc"),
    price_desc: t("sortPriceDesc"),
    relevance: t("sortRelevance"),
  };
  const sortLabel = t("sort");
  const todLabel =
    selectedTimeOfDay.length > 0
      ? `${t("timeOfDay")} · ${selectedTimeOfDay.length}`
      : t("timeOfDay");
  const moreCount =
    (qMinPrice || qMaxPrice ? 1 : 0) +
    (qDurMin || qDurMax ? 1 : 0) +
    (qPplMin || qPplMax ? 1 : 0);
  const moreLabel =
    moreCount > 0 ? `${t("moreFilters")} · ${moreCount}` : t("moreFilters");

  const formatDuration = (mins: number) => formatDurationHours(mins);

  return (
    <>
      {/* Filter pill row — stickiness + translucent chrome now live on
          the parent wrapper in `activities/page.tsx`, which stacks the
          search bar and this row into a single sticky band below the
          header (Airbnb pattern). This component just owns the pills.

          Mobile: single no-wrap row with tight pills so all five fit
          on one line (we also icon-ify "More filters"). `overflow-x-auto`
          + scrollbar-hiding utilities contain any overflow *inside*
          this row on narrow devices — if long Portuguese labels push
          the pills past viewport width, the row scrolls horizontally
          by itself instead of making the whole page scroll sideways.
          sm+ returns to the roomier wrap-and-center layout. */}
      <div className="relative flex flex-nowrap items-center justify-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-2 sm:overflow-visible">
        {/* Category */}
        <div ref={categoryAnchorRef} className="relative">
          <Pill
            label={catLabel}
            active={selectedCategoryIds.length > 0 || open === "category"}
            expanded={open === "category"}
            onClick={() => setOpen(open === "category" ? null : "category")}
          />
            {open === "category" && (
              <Popover
                anchorRef={categoryAnchorRef}
                onClose={() => setOpen(null)}
                maxWidthPx={420}
              >
                <div className="p-4 flex flex-wrap gap-2">
                  {sortedCategories.map((cat) => {
                    const active = draftCategoryIds.includes(cat.id);
                    const name = getTranslatedField(
                      cat.name as unknown as TranslatedField,
                      locale
                    );
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setDraftCategoryIds((prev) =>
                            prev.includes(cat.id)
                              ? prev.filter((x) => x !== cat.id)
                              : [...prev, cat.id]
                          )
                        }
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
                <PopoverFooter
                  clearLabel={t("clear")}
                  applyLabel={t("showResults")}
                  onClear={() => setDraftCategoryIds([])}
                  onApply={() => {
                    pushUrl({
                      category:
                        draftCategoryIds.length > 0
                          ? draftCategoryIds.join(",")
                          : undefined,
                    });
                    setOpen(null);
                  }}
                />
              </Popover>
            )}
          </div>

        {/* Neighborhood (multi-select) */}
        <div ref={neighborhoodAnchorRef} className="relative">
          <Pill
            label={nbhdLabel}
            active={selectedNeighborhoods.length > 0 || open === "neighborhood"}
            expanded={open === "neighborhood"}
            onClick={() =>
              setOpen(open === "neighborhood" ? null : "neighborhood")
            }
          />
          {open === "neighborhood" && (
            <Popover
              anchorRef={neighborhoodAnchorRef}
              onClose={() => setOpen(null)}
              maxWidthPx={260}
            >
              <ul className="max-h-80 overflow-y-auto p-2">
                {neighborhoods.map((n) => {
                  const active = draftNeighborhoods.includes(n);
                  return (
                    <li key={n}>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftNeighborhoods((prev) =>
                            prev.includes(n)
                              ? prev.filter((x) => x !== n)
                              : [...prev, n]
                          )
                        }
                        className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-charcoal-lighter/5 text-left sm:py-2"
                      >
                        <span
                          className={cn(
                            "h-5 w-5 shrink-0 rounded border flex items-center justify-center transition-colors",
                            active
                              ? "border-charcoal bg-charcoal text-white"
                              : "border-charcoal-lighter/40"
                          )}
                          aria-hidden
                        >
                          {active && (
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5a1 1 0 111.4-1.4l3.9 3.9 6.7-6.7a1 1 0 011.4 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="text-xs text-charcoal sm:text-sm">{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <PopoverFooter
                clearLabel={t("clear")}
                applyLabel={t("showResults")}
                onClear={() => setDraftNeighborhoods([])}
                onApply={() => {
                  pushUrl({
                    neighborhood:
                      draftNeighborhoods.length > 0
                        ? draftNeighborhoods.join(",")
                        : undefined,
                  });
                  setOpen(null);
                }}
              />
            </Popover>
          )}
        </div>

        {/* Time of day — hidden on mobile to keep the pill row from
            overflowing. The control still lives inside the "More
            filters" modal (see the timeOfDay section there), so mobile
            users reach it through that path. sm+ shows it inline. */}
        <div ref={timeOfDayAnchorRef} className="relative hidden sm:block">
          <Pill
            label={todLabel}
            active={selectedTimeOfDay.length > 0 || open === "timeOfDay"}
            expanded={open === "timeOfDay"}
            onClick={() =>
              setOpen(open === "timeOfDay" ? null : "timeOfDay")
            }
          />
          {open === "timeOfDay" && (
            <Popover
              anchorRef={timeOfDayAnchorRef}
              onClose={() => setOpen(null)}
              maxWidthPx={320}
            >
              {/* Single-row layout with three equal chips. Keeps the
                  popover short and matches the compact visual language
                  of the other filter pills. */}
              <div
                role="group"
                aria-label={t("timeOfDay")}
                className="flex gap-2 p-3"
              >
                {TIME_SLOTS.map((slot) => {
                  const active = draftTimeOfDay.includes(slot);
                  const labelKey =
                    slot === "morning"
                      ? "timeOfDayMorning"
                      : slot === "afternoon"
                        ? "timeOfDayAfternoon"
                        : "timeOfDayEvening";
                  const descKey = `${labelKey}Desc`;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() =>
                        setDraftTimeOfDay((prev) =>
                          prev.includes(slot)
                            ? prev.filter((x) => x !== slot)
                            : [...prev, slot]
                        )
                      }
                      aria-pressed={active}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-2 text-center transition-colors",
                        active
                          ? "border-charcoal bg-charcoal text-white"
                          : "border-charcoal-lighter/30 text-charcoal hover:border-charcoal"
                      )}
                    >
                      <span className="block text-xs font-semibold sm:text-sm">
                        {t(labelKey)}
                      </span>
                      <span
                        className={cn(
                          "block text-[11px] leading-tight sm:text-xs",
                          active ? "text-white/75" : "text-charcoal-lighter"
                        )}
                      >
                        {t(descKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <PopoverFooter
                clearLabel={t("clear")}
                applyLabel={t("showResults")}
                onClear={() => setDraftTimeOfDay([])}
                onApply={() => {
                  pushUrl({
                    timeOfDay:
                      draftTimeOfDay.length > 0
                        ? draftTimeOfDay.join(",")
                        : undefined,
                  });
                  setOpen(null);
                }}
              />
            </Popover>
          )}
        </div>

        {/* More filters — on mobile the label collapses so the pill is
            an icon-only square, freeing horizontal room for the
            other four filters. */}
        <Pill
          icon={<FiltersIcon />}
          label={moreLabel}
          active={moreCount > 0}
          onClick={() => setModalOpen(true)}
          labelHiddenOnMobile
        />

        {/* Sort by */}
        <div ref={sortAnchorRef} className="relative">
          <Pill
            label={sortLabel}
            active={open === "sort"}
            expanded={open === "sort"}
            onClick={() => setOpen(open === "sort" ? null : "sort")}
          />
          {open === "sort" && (
            <Popover
              anchorRef={sortAnchorRef}
              onClose={() => setOpen(null)}
              maxWidthPx={240}
            >
              <ul className="py-2">
                {SORT_KEYS.map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => {
                        pushUrl({ sort: k === "rating" ? undefined : k });
                        setOpen(null);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-1.5 text-xs hover:bg-charcoal-lighter/5 sm:py-2 sm:text-sm",
                        k === selectedSort && "font-semibold text-charcoal"
                      )}
                    >
                      {sortLabelMap[k]}
                    </button>
                  </li>
                ))}
                {hasSearch && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        pushUrl({ sort: "relevance" });
                        setOpen(null);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-1.5 text-xs hover:bg-charcoal-lighter/5 sm:py-2 sm:text-sm",
                        selectedSort === "relevance" &&
                          "font-semibold text-charcoal"
                      )}
                    >
                      {sortLabelMap.relevance}
                    </button>
                  </li>
                )}
              </ul>
            </Popover>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={t("filtersTitle")}
          footer={
            <ModalFooter
              clearLabel={t("clearAll")}
              applyLabel={t("showResults")}
              onClear={() => {
                setDraftCategoryIds([]);
                setDraftNeighborhoods([]);
                setDraftTimeOfDay([]);
                setPriceRange([bounds.priceMin, bounds.priceMax]);
                setDurationRange([bounds.durationMin, bounds.durationMax]);
                setPeopleRange([bounds.peopleMin, bounds.peopleMax]);
              }}
              onApply={() => {
                pushUrl({
                  category:
                    draftCategoryIds.length > 0
                      ? draftCategoryIds.join(",")
                      : undefined,
                  neighborhood:
                    draftNeighborhoods.length > 0
                      ? draftNeighborhoods.join(",")
                      : undefined,
                  timeOfDay:
                    draftTimeOfDay.length > 0
                      ? draftTimeOfDay.join(",")
                      : undefined,
                  minPrice:
                    priceRange[0] > bounds.priceMin
                      ? String(priceRange[0])
                      : undefined,
                  maxPrice:
                    priceRange[1] < bounds.priceMax
                      ? String(priceRange[1])
                      : undefined,
                  durationMin:
                    durationRange[0] > bounds.durationMin
                      ? String(durationRange[0])
                      : undefined,
                  durationMax:
                    durationRange[1] < bounds.durationMax
                      ? String(durationRange[1])
                      : undefined,
                  minPeople:
                    peopleRange[0] > bounds.peopleMin
                      ? String(peopleRange[0])
                      : undefined,
                  maxPeople:
                    peopleRange[1] < bounds.peopleMax
                      ? String(peopleRange[1])
                      : undefined,
                });
                setModalOpen(false);
              }}
            />
          }
        >
          <div className="space-y-5 sm:space-y-8">
            {/* Order chosen for scan-ability: location first (most
                people narrow by where), then duration / group size
                (trip shape), then price, time of day, and finally
                category as the fine-grained subject filter. */}
            <section>
              <h3 className="text-sm font-semibold text-charcoal mb-2 sm:text-base sm:mb-3">
                {t("neighborhood")}
              </h3>
              <ul className="max-h-64 overflow-y-auto rounded-lg border border-charcoal-lighter/15">
                {neighborhoods.map((n) => {
                  const active = draftNeighborhoods.includes(n);
                  return (
                    <li key={n}>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftNeighborhoods((prev) =>
                            prev.includes(n)
                              ? prev.filter((x) => x !== n)
                              : [...prev, n]
                          )
                        }
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-charcoal-lighter/5 text-left"
                      >
                        <span
                          className={cn(
                            "h-5 w-5 shrink-0 rounded border flex items-center justify-center transition-colors",
                            active
                              ? "border-charcoal bg-charcoal text-white"
                              : "border-charcoal-lighter/40"
                          )}
                          aria-hidden
                        >
                          {active && (
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5a1 1 0 111.4-1.4l3.9 3.9 6.7-6.7a1 1 0 011.4 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="text-xs text-charcoal sm:text-sm">{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-charcoal mb-2 sm:text-base sm:mb-3">
                {t("durationHeading")}
              </h3>
              <RangeSlider
                min={bounds.durationMin}
                max={bounds.durationMax}
                step={30}
                value={durationRange}
                onChange={setDurationRange}
                format={formatDuration}
              />
            </section>
            <section>
              <h3 className="text-sm font-semibold text-charcoal mb-2 sm:text-base sm:mb-3">
                {t("numberOfPeople")}
              </h3>
              <RangeSlider
                min={bounds.peopleMin}
                max={bounds.peopleMax}
                step={1}
                value={peopleRange}
                onChange={setPeopleRange}
                format={(n) => String(n)}
              />
            </section>
            <section>
              <h3 className="text-sm font-semibold text-charcoal mb-2 sm:text-base sm:mb-3">
                {t("priceRange")}
              </h3>
              <RangeSlider
                min={bounds.priceMin}
                max={bounds.priceMax}
                step={5}
                value={priceRange}
                onChange={setPriceRange}
                format={(n) => `R$${n}`}
                ariaMinLabel={t("minPrice")}
                ariaMaxLabel={t("maxPrice")}
              />
            </section>
            <section>
              <h3 className="text-sm font-semibold text-charcoal mb-2 sm:text-base sm:mb-3">
                {t("timeOfDay")}
              </h3>
              {/* Three equal-width chips on a single row — compact,
                  matches the popover, and keeps the modal short on
                  mobile. */}
              <div
                role="group"
                aria-label={t("timeOfDay")}
                className="flex gap-2"
              >
                {TIME_SLOTS.map((slot) => {
                  const active = draftTimeOfDay.includes(slot);
                  const labelKey =
                    slot === "morning"
                      ? "timeOfDayMorning"
                      : slot === "afternoon"
                        ? "timeOfDayAfternoon"
                        : "timeOfDayEvening";
                  const descKey = `${labelKey}Desc`;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() =>
                        setDraftTimeOfDay((prev) =>
                          prev.includes(slot)
                            ? prev.filter((x) => x !== slot)
                            : [...prev, slot]
                        )
                      }
                      aria-pressed={active}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-2 text-center transition-colors",
                        active
                          ? "border-charcoal bg-charcoal text-white"
                          : "border-charcoal-lighter/30 text-charcoal hover:border-charcoal"
                      )}
                    >
                      <span className="block text-xs font-semibold sm:text-sm">
                        {t(labelKey)}
                      </span>
                      <span
                        className={cn(
                          "block text-[11px] leading-tight sm:text-xs",
                          active ? "text-white/75" : "text-charcoal-lighter"
                        )}
                      >
                        {t(descKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-charcoal mb-2 sm:text-base sm:mb-3">
                {t("categoryLabel")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {sortedCategories.map((cat) => {
                  const active = draftCategoryIds.includes(cat.id);
                  const name = getTranslatedField(
                    cat.name as unknown as TranslatedField,
                    locale
                  );
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setDraftCategoryIds((prev) =>
                          prev.includes(cat.id)
                            ? prev.filter((x) => x !== cat.id)
                            : [...prev, cat.id]
                        )
                      }
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
            </section>
          </div>
        </Modal>
      )}
    </>
  );
}

// -------------------- Small helpers --------------------

function Pill({
  label,
  active,
  expanded,
  onClick,
  icon,
  labelHiddenOnMobile,
}: {
  label: string;
  active?: boolean;
  expanded?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  /**
   * When true, the text label and chevron collapse on mobile so the
   * pill becomes an icon-only square. Used by "More filters" so all
   * five pills fit on one line on narrow screens.
   */
  labelHiddenOnMobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={labelHiddenOnMobile ? label : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs shadow-sm transition-colors whitespace-nowrap",
        "sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm",
        active
          ? "border-charcoal"
          : "border-charcoal-lighter/30 hover:border-charcoal"
      )}
    >
      {icon}
      {/* `max-sm:hidden` collapses the label / chevron ONLY below the
          sm breakpoint, so the pill looks identical to its siblings
          on desktop. (The earlier `hidden sm:inline` pairing was
          flaky with twMerge and left the label missing at ≥sm.) */}
      <span
        className={cn(
          "text-charcoal",
          active && "font-semibold",
          labelHiddenOnMobile && "max-sm:hidden"
        )}
      >
        {label}
      </span>
      <svg
        className={cn(
          "h-3 w-3 text-charcoal-lighter transition-transform sm:h-3.5 sm:w-3.5",
          expanded && "rotate-180",
          labelHiddenOnMobile && "max-sm:hidden"
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
    </button>
  );
}

function FiltersIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-charcoal sm:h-4 sm:w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4" y1="6" x2="14" y2="6" />
      <circle cx="17" cy="6" r="2.5" />
      <line x1="10" y1="18" x2="20" y2="18" />
      <circle cx="7" cy="18" r="2.5" />
    </svg>
  );
}

/**
 * Popover anchored under a pill. Portaled to <body> with `position:
 * fixed` so it escapes the pill row's `overflow-x-auto` container
 * (which, per CSS spec, implicitly sets `overflow-y: auto` too and
 * would otherwise clip an absolute-positioned popover). Position is
 * recomputed on scroll/resize against the anchor's bounding rect so
 * the popover follows its pill as the sticky chrome moves or the
 * layout reflows.
 *
 * z-index sits above the sticky chrome (z-30) and header (z-40) but
 * below the full-filters modal (z-60).
 */
function Popover({
  anchorRef,
  onClose,
  maxWidthPx = 360,
  children,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  /**
   * Max rendered width in CSS pixels. The dialog uses
   * `min(92vw, maxWidthPx)`, and the same formula is used on the JS
   * side to clamp positioning — so the computed half-width is always
   * in lockstep with the actual painted width. Keep this matched to
   * the tallest a given popover's content needs and nothing wider.
   */
  maxWidthPx?: number;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    // Clamp the horizontal center so the translated-back popover never
    // overflows the viewport. When a filter pill sits near the left
    // edge (e.g. "Categoria" on mobile), a naive `rect.left + width/2`
    // center pushes a 92vw-wide panel off the screen on the left.
    // Earlier versions tried to measure the mounted dialog's width
    // via a ref + rAF, but the first render placed the dialog at the
    // unclamped coord and the subsequent re-measure sometimes didn't
    // land before the user saw the clipped state. Computing width
    // deterministically from `min(92vw, maxWidthPx)` matches the
    // dialog's CSS exactly and lets us clamp on the first render.
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const pad = 8;
      const width = Math.min(vw * 0.92, maxWidthPx);
      const halfW = width / 2;
      const minLeft = pad + halfW;
      const maxLeft = vw - pad - halfW;
      const center = rect.left + rect.width / 2;
      const clamped =
        minLeft <= maxLeft
          ? Math.max(minLeft, Math.min(maxLeft, center))
          : vw / 2;
      setCoords({ top: rect.bottom + 8, left: clamped });
    };
    update();
    // `capture: true` catches scroll events from any ancestor (e.g. the
    // horizontally-scrollable pill row), not just the window.
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, maxWidthPx]);

  if (!mounted || !coords) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="fixed inset-0 z-[55] cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        style={{
          top: coords.top,
          left: coords.left,
          width: `min(92vw, ${maxWidthPx}px)`,
        }}
        className="fixed -translate-x-1/2 z-[56] overflow-hidden rounded-2xl border border-charcoal-lighter/15 bg-white shadow-xl"
      >
        {children}
      </div>
    </>,
    document.body
  );
}

function PopoverFooter({
  clearLabel,
  applyLabel,
  onClear,
  onApply,
}: {
  clearLabel: string;
  applyLabel: string;
  onClear: () => void;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-charcoal-lighter/15 px-4 py-2.5 sm:py-3">
      <button
        type="button"
        onClick={onClear}
        className="text-xs font-medium text-charcoal-lighter hover:text-charcoal underline sm:text-sm"
      >
        {clearLabel}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white hover:bg-charcoal/90 sm:px-4 sm:py-2 sm:text-sm"
      >
        {applyLabel}
      </button>
    </div>
  );
}

function Modal({
  onClose,
  title,
  children,
  footer,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // SSR-safe: render nothing on the server / first client tick so we
  // don't try to access `document.body` before it exists. Once mounted
  // we portal the whole modal to document.body so it sits at the top
  // of the DOM tree, outside any ancestor that might be creating a
  // transformed/containing-block context or otherwise shifting its
  // children. Transform centering on the modal itself then lands it
  // exactly at the viewport's horizontal midpoint regardless of what
  // layout quirks exist inside <main>.
  if (!mounted) return null;

  const content = (
    // Flex-center the dialog inside the fixed viewport container.
    // Flexbox centering is immune to the `100vw`-vs-scrollbar gotcha
    // that bites transform-based centering: when the page has a
    // vertical scrollbar, `100vw` resolves to the *layout* viewport
    // (incl. scrollbar), so `calc(100vw - Npx)` + `left-1/2 translate-x`
    // lands slightly right of the visual center. `inset-0` + `flex`
    // uses the fixed element's own box (which excludes the scrollbar),
    // so centering lines up with what the user actually sees.
    // `p-6` supplies the side gutter; inner dialog takes `w-full`.
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 sm:p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-black/40 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        className="relative flex w-full max-w-sm max-h-[75vh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-w-md sm:max-h-[85vh]"
      >
        <header className="relative flex items-center justify-center border-b border-charcoal-lighter/15 px-4 py-3 sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute left-3 text-2xl leading-none text-charcoal-lighter hover:text-charcoal sm:left-4"
          >
            ×
          </button>
          <h2 className="text-base font-semibold text-charcoal sm:text-lg">{title}</h2>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-6">
          {children}
        </div>
        {footer}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function ModalFooter({
  clearLabel,
  applyLabel,
  onClear,
  onApply,
}: {
  clearLabel: string;
  applyLabel: string;
  onClear: () => void;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-charcoal-lighter/15 px-4 py-3 sm:px-5 sm:py-4">
      <button
        type="button"
        onClick={onClear}
        className="text-xs font-medium text-charcoal-lighter hover:text-charcoal underline sm:text-sm"
      >
        {clearLabel}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="rounded-lg bg-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-charcoal/90 sm:px-5 sm:py-2.5 sm:text-sm"
      >
        {applyLabel}
      </button>
    </div>
  );
}
