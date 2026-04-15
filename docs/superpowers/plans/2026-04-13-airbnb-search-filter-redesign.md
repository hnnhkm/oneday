# Airbnb-Style Search & Filter Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the /activities page form-based filter bar with an Airbnb Experiences two-state pattern: expanded search bar (Where/When/Price) on landing, collapsed summary pill + filter pill bar on results.

**Architecture:** The `ActivitySearchBar` client component reads URL params to determine state. Landing state renders `ExpandedSearchBar` with three segment panels. Results state renders `CollapsedSearchBar` + `FilterPillBar` with dropdown/modal sub-components. All filter changes produce URL navigations — no new backend or API routes.

**Tech Stack:** Next.js 14 App Router, React client components, Tailwind CSS with existing design tokens, next-intl for i18n, useSearchParams + router.push for state

**Spec:** `docs/superpowers/specs/2026-04-13-airbnb-search-filter-redesign.md`

---

## File Map

### New files (all in `src/components/activities/search/`)

| File | Responsibility |
|------|---------------|
| `activity-search-bar.tsx` | Two-state orchestrator — renders expanded or collapsed based on URL params |
| `expanded-search-bar.tsx` | Desktop: 3-segment pill (Where/When/Price). Mobile: "Start your search" button that opens full-screen overlay |
| `neighborhood-panel.tsx` | "Where" segment dropdown — list of neighborhoods |
| `date-panel.tsx` | "When" segment dropdown — quick picks (Today/Tomorrow/This weekend) + month calendar |
| `price-panel.tsx` | "Price" segment dropdown — min/max number inputs |
| `collapsed-search-bar.tsx` | Compact summary pill showing active filter summary |
| `filter-pill-bar.tsx` | Horizontal row of filter pills (Category, Neighborhood, Sort, More Filters) |
| `filter-pill.tsx` | Individual pill button with open/close + active styling |
| `category-dropdown.tsx` | Grid of category chips with icons, Clear + Show results footer |
| `neighborhood-dropdown.tsx` | Neighborhood list dropdown for filter pill |
| `sort-dropdown.tsx` | Sort options dropdown |
| `more-filters-modal.tsx` | Modal (desktop) / bottom sheet (mobile) with date range + price range + text search |
| `dropdown-footer.tsx` | Shared footer: "Clear" + "Show results" button |
| `quick-date-picks.tsx` | "Today", "Tomorrow", "This weekend" pill buttons |
| `bottom-sheet.tsx` | Reusable mobile bottom sheet wrapper with backdrop + sticky header/footer |
| `search-overlay.tsx` | Mobile full-screen overlay for the landing state search flow |

### Modified files

| File | Change |
|------|--------|
| `src/app/[locale]/activities/page.tsx` | Replace SearchBar + ActivityFilters + ActivitySort with ActivitySearchBar. Compute `hasActiveFilters`. |
| `src/messages/en.json` | Add ~16 new translation keys under "activities" |
| `src/messages/pt.json` | Same keys, Portuguese translations |
| `src/messages/es.json` | Same keys, Spanish translations |

### Removed imports (files kept but no longer imported on activities page)

| File | Status |
|------|--------|
| `src/components/activities/activity-filters.tsx` | No longer imported by page.tsx. Keep file for now (other pages may reference). |
| `src/components/activities/activity-sort.tsx` | No longer imported by page.tsx. Keep file. |
| `src/components/search/search-bar.tsx` | No longer imported by activities page.tsx. Still used by homepage. |

---

## Task 1: Add i18n translation keys

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/pt.json`
- Modify: `src/messages/es.json`

- [ ] **Step 1: Add English translation keys**

Open `src/messages/en.json`. Inside the `"activities"` object, add these keys (place them after the existing `"clearFilters"` key):

```json
"searchWhere": "Where",
"searchWhen": "When",
"searchPrice": "Price",
"searchByNeighborhood": "Search by neighborhood",
"addDates": "Add dates",
"addPriceRange": "Add price range",
"startSearch": "Start your search",
"today": "Today",
"tomorrow": "Tomorrow",
"thisWeekend": "This weekend",
"anytime": "Anytime",
"showResults": "Show results",
"clearAll": "Clear all",
"moreFilters": "More filters",
"allNeighborhoodsShort": "All neighborhoods",
"categoryLabel": "Category"
```

- [ ] **Step 2: Add Portuguese translation keys**

Open `src/messages/pt.json`. Inside `"activities"`, add:

```json
"searchWhere": "Onde",
"searchWhen": "Quando",
"searchPrice": "Preco",
"searchByNeighborhood": "Buscar por bairro",
"addDates": "Adicionar datas",
"addPriceRange": "Adicionar faixa de preco",
"startSearch": "Comece sua busca",
"today": "Hoje",
"tomorrow": "Amanha",
"thisWeekend": "Este fim de semana",
"anytime": "Qualquer data",
"showResults": "Mostrar resultados",
"clearAll": "Limpar tudo",
"moreFilters": "Mais filtros",
"allNeighborhoodsShort": "Todos os bairros",
"categoryLabel": "Categoria"
```

- [ ] **Step 3: Add Spanish translation keys**

Open `src/messages/es.json`. Inside `"activities"`, add:

```json
"searchWhere": "Donde",
"searchWhen": "Cuando",
"searchPrice": "Precio",
"searchByNeighborhood": "Buscar por barrio",
"addDates": "Agregar fechas",
"addPriceRange": "Agregar rango de precio",
"startSearch": "Comienza tu busqueda",
"today": "Hoy",
"tomorrow": "Manana",
"thisWeekend": "Este fin de semana",
"anytime": "Cualquier fecha",
"showResults": "Mostrar resultados",
"clearAll": "Limpiar todo",
"moreFilters": "Mas filtros",
"allNeighborhoodsShort": "Todos los barrios",
"categoryLabel": "Categoria"
```

- [ ] **Step 4: Verify the app still builds with new keys**

Run: `cd hobby-marketplace && npx next build 2>&1 | tail -5`
Expected: Build succeeds (or at least no i18n errors).

- [ ] **Step 5: Commit**

```bash
git add src/messages/en.json src/messages/pt.json src/messages/es.json
git commit -m "i18n: add translation keys for Airbnb-style search/filter UI"
```

---

## Task 2: DropdownFooter + FilterPill shared components

These are small, reusable primitives used by every dropdown in later tasks.

**Files:**
- Create: `src/components/activities/search/dropdown-footer.tsx`
- Create: `src/components/activities/search/filter-pill.tsx`
- Create: `src/components/activities/search/bottom-sheet.tsx`

- [ ] **Step 1: Create DropdownFooter**

Create `src/components/activities/search/dropdown-footer.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

interface DropdownFooterProps {
  onClear: () => void;
  onApply: () => void;
  hasSelection: boolean;
}

export function DropdownFooter({ onClear, onApply, hasSelection }: DropdownFooterProps) {
  const t = useTranslations("activities");

  return (
    <div className="flex items-center justify-between border-t border-charcoal-lighter/10 pt-3 mt-3">
      <button
        type="button"
        onClick={onClear}
        className="text-sm text-charcoal-lighter underline underline-offset-2 hover:text-charcoal disabled:opacity-40"
        disabled={!hasSelection}
      >
        {t("clearAll")}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="rounded-lg bg-charcoal px-5 py-2.5 text-sm font-medium text-white hover:bg-charcoal-light transition-colors"
      >
        {t("showResults")}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create FilterPill**

Create `src/components/activities/search/filter-pill.tsx`:

```tsx
"use client";

import { useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterPillProps {
  label: string;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function FilterPill({ label, isActive, isOpen, onToggle, children }: FilterPillProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all whitespace-nowrap",
          isActive
            ? "border-charcoal bg-charcoal/5 text-charcoal"
            : "border-charcoal-lighter/30 bg-white text-charcoal hover:shadow-card",
          isOpen && "shadow-card-hover border-charcoal"
        )}
      >
        {label}
        <svg
          className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-40 mt-2 hidden md:block">
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create BottomSheet**

Create `src/components/activities/search/bottom-sheet.tsx`:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal-lighter/10">
          <h2 className="text-base font-semibold text-charcoal">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-background-muted"
            aria-label="Close"
          >
            <svg className="h-5 w-5 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && (
          <div className="px-5 py-4 border-t border-charcoal-lighter/10">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/activities/search/
git commit -m "feat: add DropdownFooter, FilterPill, BottomSheet shared components"
```

---

## Task 3: QuickDatePicks + DatePanel + PricePanel + NeighborhoodPanel

The three dropdown panels for the expanded search bar segments.

**Files:**
- Create: `src/components/activities/search/quick-date-picks.tsx`
- Create: `src/components/activities/search/date-panel.tsx`
- Create: `src/components/activities/search/price-panel.tsx`
- Create: `src/components/activities/search/neighborhood-panel.tsx`

- [ ] **Step 1: Create QuickDatePicks**

Create `src/components/activities/search/quick-date-picks.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface QuickDatePicksProps {
  selected: string | null;
  onSelect: (dateFrom: string, dateTo: string, label: string) => void;
}

function formatISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function QuickDatePicks({ selected, onSelect }: QuickDatePicksProps) {
  const t = useTranslations("activities");

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayOfWeek = today.getDay();
  const friday = new Date(today);
  friday.setDate(today.getDate() + ((5 - dayOfWeek + 7) % 7));
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  const picks = [
    { label: t("today"), sub: today.toLocaleDateString("en", { month: "short", day: "numeric" }), from: formatISO(today), to: formatISO(today) },
    { label: t("tomorrow"), sub: tomorrow.toLocaleDateString("en", { month: "short", day: "numeric" }), from: formatISO(tomorrow), to: formatISO(tomorrow) },
    { label: t("thisWeekend"), sub: `${friday.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en", { month: "short", day: "numeric" })}`, from: formatISO(friday), to: formatISO(sunday) },
  ];

  return (
    <div className="flex gap-2">
      {picks.map((pick) => (
        <button
          key={pick.label}
          type="button"
          onClick={() => onSelect(pick.from, pick.to, pick.label)}
          className={cn(
            "flex-1 rounded-xl border px-3 py-3 text-left transition-colors",
            selected === pick.from
              ? "border-charcoal bg-charcoal/5"
              : "border-charcoal-lighter/20 hover:border-charcoal-lighter/50"
          )}
        >
          <div className="text-sm font-semibold text-charcoal">{pick.label}</div>
          <div className="text-xs text-charcoal-lighter mt-0.5">{pick.sub}</div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create DatePanel**

Create `src/components/activities/search/date-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { QuickDatePicks } from "./quick-date-picks";

interface DatePanelProps {
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function DatePanel({ dateFrom, dateTo, onChange }: DatePanelProps) {
  const t = useTranslations("activities");
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en", { month: "long", year: "numeric" });

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!dateFrom || (dateFrom && dateTo)) {
      onChange(dateStr, "");
    } else {
      if (dateStr < dateFrom) {
        onChange(dateStr, dateFrom);
      } else {
        onChange(dateFrom, dateStr);
      }
    }
  }

  function isInRange(day: number): boolean {
    if (!dateFrom || !dateTo) return false;
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dateStr >= dateFrom && dateStr <= dateTo;
  }

  function isSelected(day: number): boolean {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dateStr === dateFrom || dateStr === dateTo;
  }

  function isPast(day: number): boolean {
    const date = new Date(viewYear, viewMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  return (
    <div className="w-full">
      <QuickDatePicks
        selected={dateFrom}
        onSelect={(from, to) => onChange(from, to)}
      />

      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-background-muted">
            <svg className="h-4 w-4 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-charcoal">{monthLabel}</span>
          <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-background-muted">
            <svg className="h-4 w-4 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0 text-center">
          {DAYS.map((d, i) => (
            <div key={i} className="text-xs font-medium text-charcoal-lighter py-1">{d}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const past = isPast(day);
            const selected = isSelected(day);
            const inRange = isInRange(day);
            return (
              <button
                key={day}
                type="button"
                disabled={past}
                onClick={() => selectDay(day)}
                className={cn(
                  "py-1.5 text-sm rounded-full transition-colors",
                  past && "text-charcoal-lighter/40 cursor-not-allowed",
                  !past && !selected && !inRange && "text-charcoal hover:bg-background-muted",
                  inRange && !selected && "bg-primary-50 text-charcoal",
                  selected && "bg-charcoal text-white font-semibold"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create PricePanel**

Create `src/components/activities/search/price-panel.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

interface PricePanelProps {
  minPrice: string;
  maxPrice: string;
  onChange: (min: string, max: string) => void;
}

export function PricePanel({ minPrice, maxPrice, onChange }: PricePanelProps) {
  const t = useTranslations("activities");

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-charcoal-lighter mb-1">
            {t("minPrice")}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal-lighter">R$</span>
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(e) => onChange(e.target.value, maxPrice)}
              placeholder="0"
              className="w-full rounded-lg border border-charcoal-lighter/30 bg-white pl-9 pr-3 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>
        </div>
        <span className="text-charcoal-lighter mt-5">–</span>
        <div className="flex-1">
          <label className="block text-xs font-medium text-charcoal-lighter mb-1">
            {t("maxPrice")}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal-lighter">R$</span>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => onChange(minPrice, e.target.value)}
              placeholder="500+"
              className="w-full rounded-lg border border-charcoal-lighter/30 bg-white pl-9 pr-3 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create NeighborhoodPanel**

Create `src/components/activities/search/neighborhood-panel.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface NeighborhoodPanelProps {
  neighborhoods: string[];
  selected: string;
  onSelect: (neighborhood: string) => void;
}

export function NeighborhoodPanel({ neighborhoods, selected, onSelect }: NeighborhoodPanelProps) {
  const t = useTranslations("activities");

  return (
    <div className="w-full">
      <div className="space-y-1">
        {neighborhoods.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(n === selected ? "" : n)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
              n === selected
                ? "bg-background-muted font-medium text-charcoal"
                : "text-charcoal hover:bg-background-muted/60"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/activities/search/
git commit -m "feat: add QuickDatePicks, DatePanel, PricePanel, NeighborhoodPanel"
```

---

## Task 4: ExpandedSearchBar + SearchOverlay (landing state)

**Files:**
- Create: `src/components/activities/search/expanded-search-bar.tsx`
- Create: `src/components/activities/search/search-overlay.tsx`

- [ ] **Step 1: Create ExpandedSearchBar (desktop)**

Create `src/components/activities/search/expanded-search-bar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { NeighborhoodPanel } from "./neighborhood-panel";
import { DatePanel } from "./date-panel";
import { PricePanel } from "./price-panel";
import { SearchOverlay } from "./search-overlay";

type Segment = "where" | "when" | "price" | null;

interface ExpandedSearchBarProps {
  neighborhoods: string[];
  initialNeighborhood?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialMinPrice?: string;
  initialMaxPrice?: string;
}

export function ExpandedSearchBar({
  neighborhoods,
  initialNeighborhood = "",
  initialDateFrom = "",
  initialDateTo = "",
  initialMinPrice = "",
  initialMaxPrice = "",
}: ExpandedSearchBarProps) {
  const t = useTranslations("activities");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeSegment, setActiveSegment] = useState<Segment>(null);
  const [neighborhood, setNeighborhood] = useState(initialNeighborhood);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleSearch() {
    const params = new URLSearchParams();
    if (neighborhood) params.set("neighborhood", neighborhood);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);

    // Preserve view param
    const view = searchParams.get("view");
    if (view) params.set("view", view);

    const qs = params.toString();
    router.push(`/activities${qs ? `?${qs}` : ""}` as "/activities");
    setMobileOpen(false);
  }

  function toggleSegment(seg: Segment) {
    setActiveSegment((prev) => (prev === seg ? null : seg));
  }

  const neighborhoodLabel = neighborhood || t("searchByNeighborhood");
  const dateLabel = dateFrom
    ? dateTo && dateTo !== dateFrom
      ? `${new Date(dateFrom + "T12:00").toLocaleDateString("en", { month: "short", day: "numeric" })} – ${new Date(dateTo + "T12:00").toLocaleDateString("en", { month: "short", day: "numeric" })}`
      : new Date(dateFrom + "T12:00").toLocaleDateString("en", { month: "short", day: "numeric" })
    : t("addDates");
  const priceLabel = minPrice || maxPrice
    ? `R$${minPrice || "0"} – R$${maxPrice || "500+"}`
    : t("addPriceRange");

  return (
    <>
      {/* Mobile: "Start your search" button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden w-full rounded-full border border-charcoal-lighter/20 bg-white px-5 py-3.5 text-sm text-charcoal-lighter shadow-card flex items-center gap-2"
      >
        <svg className="h-4 w-4 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {t("startSearch")}
      </button>

      {/* Mobile: Full-screen overlay */}
      <SearchOverlay
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        neighborhoods={neighborhoods}
        neighborhood={neighborhood}
        onNeighborhoodChange={setNeighborhood}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onPriceChange={(min, max) => { setMinPrice(min); setMaxPrice(max); }}
        onSearch={handleSearch}
      />

      {/* Desktop: Three-segment bar */}
      <div className="hidden md:block relative">
        <div className="mx-auto max-w-2xl rounded-full border border-charcoal-lighter/20 bg-white shadow-card flex items-stretch">
          {/* Where segment */}
          <button
            type="button"
            onClick={() => toggleSegment("where")}
            className={cn(
              "flex-1 text-left px-6 py-3 rounded-l-full transition-colors",
              activeSegment === "where" ? "bg-background-muted" : "hover:bg-background-muted/50"
            )}
          >
            <div className="text-xs font-semibold text-charcoal">{t("searchWhere")}</div>
            <div className={cn("text-sm truncate", neighborhood ? "text-charcoal" : "text-charcoal-lighter")}>{neighborhoodLabel}</div>
          </button>

          <div className="w-px bg-charcoal-lighter/20 my-2.5" />

          {/* When segment */}
          <button
            type="button"
            onClick={() => toggleSegment("when")}
            className={cn(
              "flex-1 text-left px-6 py-3 transition-colors",
              activeSegment === "when" ? "bg-background-muted" : "hover:bg-background-muted/50"
            )}
          >
            <div className="text-xs font-semibold text-charcoal">{t("searchWhen")}</div>
            <div className={cn("text-sm truncate", dateFrom ? "text-charcoal" : "text-charcoal-lighter")}>{dateLabel}</div>
          </button>

          <div className="w-px bg-charcoal-lighter/20 my-2.5" />

          {/* Price segment */}
          <button
            type="button"
            onClick={() => toggleSegment("price")}
            className={cn(
              "flex-1 text-left px-6 py-3 transition-colors",
              activeSegment === "price" ? "bg-background-muted" : "hover:bg-background-muted/50"
            )}
          >
            <div className="text-xs font-semibold text-charcoal">{t("searchPrice")}</div>
            <div className={cn("text-sm truncate", minPrice || maxPrice ? "text-charcoal" : "text-charcoal-lighter")}>{priceLabel}</div>
          </button>

          {/* Search button */}
          <div className="flex items-center pr-2">
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-full bg-primary-400 text-white p-3 hover:bg-primary-500 transition-colors flex items-center gap-1.5"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dropdown panels (desktop only) */}
        {activeSegment && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 z-40 bg-white rounded-xl shadow-dropdown border border-charcoal-lighter/10 p-5 w-[420px]">
            {activeSegment === "where" && (
              <NeighborhoodPanel
                neighborhoods={neighborhoods}
                selected={neighborhood}
                onSelect={(n) => { setNeighborhood(n); setActiveSegment(null); }}
              />
            )}
            {activeSegment === "when" && (
              <DatePanel
                dateFrom={dateFrom}
                dateTo={dateTo}
                onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
              />
            )}
            {activeSegment === "price" && (
              <PricePanel
                minPrice={minPrice}
                maxPrice={maxPrice}
                onChange={(min, max) => { setMinPrice(min); setMaxPrice(max); }}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create SearchOverlay (mobile full-screen flow)**

Create `src/components/activities/search/search-overlay.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NeighborhoodPanel } from "./neighborhood-panel";
import { DatePanel } from "./date-panel";
import { PricePanel } from "./price-panel";

type Card = "where" | "when" | "price" | null;

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  neighborhoods: string[];
  neighborhood: string;
  onNeighborhoodChange: (n: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
  minPrice: string;
  maxPrice: string;
  onPriceChange: (min: string, max: string) => void;
  onSearch: () => void;
}

export function SearchOverlay({
  open,
  onClose,
  neighborhoods,
  neighborhood,
  onNeighborhoodChange,
  dateFrom,
  dateTo,
  onDateChange,
  minPrice,
  maxPrice,
  onPriceChange,
  onSearch,
}: SearchOverlayProps) {
  const t = useTranslations("activities");
  const [expandedCard, setExpandedCard] = useState<Card>("where");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setExpandedCard("where");
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  function handleClear() {
    onNeighborhoodChange("");
    onDateChange("", "");
    onPriceChange("", "");
  }

  const dateLabel = dateFrom
    ? dateTo && dateTo !== dateFrom
      ? `${new Date(dateFrom + "T12:00").toLocaleDateString("en", { month: "short", day: "numeric" })} – ${new Date(dateTo + "T12:00").toLocaleDateString("en", { month: "short", day: "numeric" })}`
      : new Date(dateFrom + "T12:00").toLocaleDateString("en", { month: "short", day: "numeric" })
    : t("addDates");
  const priceLabel = minPrice || maxPrice
    ? `R$${minPrice || "0"} – R$${maxPrice || "500+"}`
    : t("addPriceRange");

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-end px-4 py-3">
        <button type="button" onClick={onClose} className="rounded-full p-1.5 border border-charcoal-lighter/20">
          <svg className="h-4 w-4 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stacked cards */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3">
        {/* Where card */}
        <button
          type="button"
          onClick={() => setExpandedCard(expandedCard === "where" ? null : "where")}
          className={cn(
            "w-full bg-white rounded-xl shadow-card text-left transition-all",
            expandedCard !== "where" && "px-5 py-4 flex justify-between items-center"
          )}
        >
          {expandedCard === "where" ? null : (
            <>
              <span className="text-sm text-charcoal-lighter">{t("searchWhere")}</span>
              <span className="text-sm font-medium text-charcoal">{neighborhood || t("allNeighborhoodsShort")}</span>
            </>
          )}
        </button>
        {expandedCard === "where" && (
          <div className="bg-white rounded-xl shadow-card p-5">
            <h3 className="text-lg font-semibold text-charcoal mb-3">{t("searchWhere")}?</h3>
            <NeighborhoodPanel
              neighborhoods={neighborhoods}
              selected={neighborhood}
              onSelect={(n) => { onNeighborhoodChange(n); setExpandedCard("when"); }}
            />
          </div>
        )}

        {/* When card */}
        <button
          type="button"
          onClick={() => setExpandedCard(expandedCard === "when" ? null : "when")}
          className={cn(
            "w-full bg-white rounded-xl shadow-card text-left transition-all",
            expandedCard !== "when" && "px-5 py-4 flex justify-between items-center"
          )}
        >
          {expandedCard === "when" ? null : (
            <>
              <span className="text-sm text-charcoal-lighter">{t("searchWhen")}</span>
              <span className="text-sm font-medium text-charcoal">{dateLabel}</span>
            </>
          )}
        </button>
        {expandedCard === "when" && (
          <div className="bg-white rounded-xl shadow-card p-5">
            <h3 className="text-lg font-semibold text-charcoal mb-3">{t("searchWhen")}?</h3>
            <DatePanel dateFrom={dateFrom} dateTo={dateTo} onChange={onDateChange} />
          </div>
        )}

        {/* Price card */}
        <button
          type="button"
          onClick={() => setExpandedCard(expandedCard === "price" ? null : "price")}
          className={cn(
            "w-full bg-white rounded-xl shadow-card text-left transition-all",
            expandedCard !== "price" && "px-5 py-4 flex justify-between items-center"
          )}
        >
          {expandedCard === "price" ? null : (
            <>
              <span className="text-sm text-charcoal-lighter">{t("searchPrice")}</span>
              <span className="text-sm font-medium text-charcoal">{priceLabel}</span>
            </>
          )}
        </button>
        {expandedCard === "price" && (
          <div className="bg-white rounded-xl shadow-card p-5">
            <h3 className="text-lg font-semibold text-charcoal mb-3">{t("searchPrice")}</h3>
            <PricePanel minPrice={minPrice} maxPrice={maxPrice} onChange={onPriceChange} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-charcoal-lighter/10 bg-white flex items-center justify-between">
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
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/activities/search/
git commit -m "feat: add ExpandedSearchBar + SearchOverlay for landing state"
```

---

## Task 5: CollapsedSearchBar (results state top bar)

**Files:**
- Create: `src/components/activities/search/collapsed-search-bar.tsx`

- [ ] **Step 1: Create CollapsedSearchBar**

Create `src/components/activities/search/collapsed-search-bar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { ExpandedSearchBar } from "./expanded-search-bar";

interface CollapsedSearchBarProps {
  neighborhoods: string[];
  locale: string;
}

export function CollapsedSearchBar({ neighborhoods, locale }: CollapsedSearchBarProps) {
  const t = useTranslations("activities");
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState(false);

  const neighborhood = searchParams.get("neighborhood");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  const parts: string[] = [];
  parts.push(neighborhood || t("allNeighborhoodsShort"));

  if (dateFrom) {
    if (dateTo && dateTo !== dateFrom) {
      parts.push(
        `${new Date(dateFrom + "T12:00").toLocaleDateString(locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric" })} – ${new Date(dateTo + "T12:00").toLocaleDateString(locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric" })}`
      );
    } else {
      parts.push(new Date(dateFrom + "T12:00").toLocaleDateString(locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric" }));
    }
  } else {
    parts.push(t("anytime"));
  }

  if (minPrice || maxPrice) {
    parts.push(`R$${minPrice || "0"} – R$${maxPrice || "500+"}`);
  }

  const summary = parts.join(" · ");

  if (editing) {
    return (
      <div className="relative">
        <div className="fixed inset-0 z-30 bg-black/20 md:bg-transparent" onClick={() => setEditing(false)} />
        <div className="relative z-40">
          <ExpandedSearchBar
            neighborhoods={neighborhoods}
            initialNeighborhood={neighborhood || ""}
            initialDateFrom={dateFrom || ""}
            initialDateTo={dateTo || ""}
            initialMinPrice={minPrice || ""}
            initialMaxPrice={maxPrice || ""}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-3 rounded-full border border-charcoal-lighter/20 bg-white px-5 py-2.5 shadow-card hover:shadow-card-hover transition-shadow max-w-lg"
      >
        <span className="text-sm font-medium text-charcoal truncate">{summary}</span>
        <div className="rounded-full bg-primary-400 p-2 flex-shrink-0">
          <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activities/search/collapsed-search-bar.tsx
git commit -m "feat: add CollapsedSearchBar for results state"
```

---

## Task 6: CategoryDropdown + NeighborhoodDropdown + SortDropdown + MoreFiltersModal

**Files:**
- Create: `src/components/activities/search/category-dropdown.tsx`
- Create: `src/components/activities/search/neighborhood-dropdown.tsx`
- Create: `src/components/activities/search/sort-dropdown.tsx`
- Create: `src/components/activities/search/more-filters-modal.tsx`

- [ ] **Step 1: Create CategoryDropdown**

Create `src/components/activities/search/category-dropdown.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn, getTranslatedField } from "@/lib/utils";
import { DropdownFooter } from "./dropdown-footer";
import type { Category, TranslatedField } from "@/lib/types/database";

interface CategoryDropdownProps {
  categories: Category[];
  selected: string[];
  locale: string;
  onApply: (ids: string[]) => void;
}

export function CategoryDropdown({ categories, selected, locale, onApply }: CategoryDropdownProps) {
  const t = useTranslations("activities");
  const [localIds, setLocalIds] = useState<string[]>(selected);

  function toggle(id: string) {
    setLocalIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }

  return (
    <div className="bg-white rounded-xl shadow-dropdown border border-charcoal-lighter/10 p-5 w-[480px] max-w-[calc(100vw-2rem)]">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const active = localIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggle(cat.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors",
                active
                  ? "border-charcoal bg-charcoal/5 font-medium text-charcoal"
                  : "border-charcoal-lighter/30 text-charcoal hover:border-charcoal-lighter/50"
              )}
            >
              <span>{cat.icon}</span>
              <span>{getTranslatedField(cat.name as unknown as TranslatedField, locale)}</span>
            </button>
          );
        })}
      </div>
      <DropdownFooter
        onClear={() => { setLocalIds([]); onApply([]); }}
        onApply={() => onApply(localIds)}
        hasSelection={localIds.length > 0}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create NeighborhoodDropdown**

Create `src/components/activities/search/neighborhood-dropdown.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DropdownFooter } from "./dropdown-footer";

interface NeighborhoodDropdownProps {
  neighborhoods: string[];
  selected: string;
  onApply: (neighborhood: string) => void;
}

export function NeighborhoodDropdown({ neighborhoods, selected, onApply }: NeighborhoodDropdownProps) {
  const t = useTranslations("activities");
  const [local, setLocal] = useState(selected);

  return (
    <div className="bg-white rounded-xl shadow-dropdown border border-charcoal-lighter/10 p-4 w-[280px] max-h-[360px] flex flex-col">
      <div className="overflow-y-auto flex-1 space-y-0.5">
        {neighborhoods.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setLocal(n === local ? "" : n)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
              n === local
                ? "bg-background-muted font-medium text-charcoal"
                : "text-charcoal hover:bg-background-muted/60"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <DropdownFooter
        onClear={() => { setLocal(""); onApply(""); }}
        onApply={() => onApply(local)}
        hasSelection={!!local}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create SortDropdown**

Create `src/components/activities/search/sort-dropdown.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DropdownFooter } from "./dropdown-footer";

interface SortDropdownProps {
  current: string;
  hasSearch: boolean;
  onApply: (sort: string) => void;
}

const SORT_OPTIONS = ["rating", "newest", "price_asc", "price_desc"] as const;

export function SortDropdown({ current, hasSearch, onApply }: SortDropdownProps) {
  const t = useTranslations("activities");
  const [local, setLocal] = useState(current);

  const options = hasSearch
    ? ["relevance" as const, ...SORT_OPTIONS]
    : SORT_OPTIONS;

  const labelKeys: Record<string, string> = {
    relevance: "sortRelevance",
    rating: "sortRating",
    newest: "sortNewest",
    price_asc: "sortPriceAsc",
    price_desc: "sortPriceDesc",
  };

  return (
    <div className="bg-white rounded-xl shadow-dropdown border border-charcoal-lighter/10 p-4 w-[220px]">
      <div className="space-y-0.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setLocal(opt)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
              opt === local
                ? "bg-background-muted font-medium text-charcoal"
                : "text-charcoal hover:bg-background-muted/60"
            )}
          >
            {t(labelKeys[opt])}
          </button>
        ))}
      </div>
      <DropdownFooter
        onClear={() => { setLocal("rating"); onApply("rating"); }}
        onApply={() => onApply(local)}
        hasSelection={local !== "rating"}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create MoreFiltersModal**

Create `src/components/activities/search/more-filters-modal.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { DropdownFooter } from "./dropdown-footer";
import { DatePanel } from "./date-panel";
import { PricePanel } from "./price-panel";

interface MoreFiltersModalProps {
  open: boolean;
  onClose: () => void;
  dateFrom: string;
  dateTo: string;
  minPrice: string;
  maxPrice: string;
  search: string;
  onApply: (filters: { dateFrom: string; dateTo: string; minPrice: string; maxPrice: string; search: string }) => void;
}

export function MoreFiltersModal({
  open,
  onClose,
  dateFrom: initDateFrom,
  dateTo: initDateTo,
  minPrice: initMinPrice,
  maxPrice: initMaxPrice,
  search: initSearch,
  onApply,
}: MoreFiltersModalProps) {
  const t = useTranslations("activities");
  const [dateFrom, setDateFrom] = useState(initDateFrom);
  const [dateTo, setDateTo] = useState(initDateTo);
  const [minPrice, setMinPrice] = useState(initMinPrice);
  const [maxPrice, setMaxPrice] = useState(initMaxPrice);
  const [search, setSearch] = useState(initSearch);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setDateFrom(initDateFrom);
      setDateTo(initDateTo);
      setMinPrice(initMinPrice);
      setMaxPrice(initMaxPrice);
      setSearch(initSearch);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, initDateFrom, initDateTo, initMinPrice, initMaxPrice, initSearch]);

  if (!open) return null;

  function handleClear() {
    setDateFrom("");
    setDateTo("");
    setMinPrice("");
    setMaxPrice("");
    setSearch("");
  }

  function handleApply() {
    onApply({ dateFrom, dateTo, minPrice, maxPrice, search });
    onClose();
  }

  const hasSelection = !!(dateFrom || dateTo || minPrice || maxPrice || search);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Desktop: centered modal. Mobile: full-screen sheet. */}
      <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl max-h-[80vh] flex flex-col md:mx-auto
                      md:rounded-xl md:max-h-[80vh]
                      max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:mx-0 max-md:rounded-t-xl max-md:rounded-b-none max-md:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal-lighter/10">
          <h2 className="text-base font-semibold text-charcoal">{t("moreFilters")}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-background-muted">
            <svg className="h-5 w-5 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Text search */}
          <div>
            <label className="block text-sm font-semibold text-charcoal mb-2">
              {t("browseTitle")}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("browseTitle")}
              className="w-full rounded-lg border border-charcoal-lighter/30 bg-white px-4 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>

          {/* Date range */}
          <div>
            <h3 className="text-sm font-semibold text-charcoal mb-3">{t("dateRange")}</h3>
            <DatePanel dateFrom={dateFrom} dateTo={dateTo} onChange={(from, to) => { setDateFrom(from); setDateTo(to); }} />
          </div>

          {/* Price range */}
          <div>
            <h3 className="text-sm font-semibold text-charcoal mb-3">{t("priceRange")}</h3>
            <PricePanel minPrice={minPrice} maxPrice={maxPrice} onChange={(min, max) => { setMinPrice(min); setMaxPrice(max); }} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-charcoal-lighter/10">
          <DropdownFooter onClear={handleClear} onApply={handleApply} hasSelection={hasSelection} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/activities/search/
git commit -m "feat: add CategoryDropdown, NeighborhoodDropdown, SortDropdown, MoreFiltersModal"
```

---

## Task 7: FilterPillBar (results state filter row)

**Files:**
- Create: `src/components/activities/search/filter-pill-bar.tsx`

- [ ] **Step 1: Create FilterPillBar**

Create `src/components/activities/search/filter-pill-bar.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { getTranslatedField } from "@/lib/utils";
import { FilterPill } from "./filter-pill";
import { CategoryDropdown } from "./category-dropdown";
import { NeighborhoodDropdown } from "./neighborhood-dropdown";
import { SortDropdown } from "./sort-dropdown";
import { MoreFiltersModal } from "./more-filters-modal";
import { BottomSheet } from "./bottom-sheet";
import { DropdownFooter } from "./dropdown-footer";
import type { Category, TranslatedField } from "@/lib/types/database";

interface FilterPillBarProps {
  categories: Category[];
  neighborhoods: string[];
  locale: string;
}

type OpenPill = "category" | "neighborhood" | "sort" | "more" | null;

export function FilterPillBar({ categories, neighborhoods, locale }: FilterPillBarProps) {
  const t = useTranslations("activities");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openPill, setOpenPill] = useState<OpenPill>(null);

  const currentCategoryIds = (searchParams.get("category") || "").split(",").filter(Boolean);
  const currentNeighborhood = searchParams.get("neighborhood") || "";
  const currentSort = searchParams.get("sort") || (searchParams.get("search") ? "relevance" : "rating");
  const hasSearch = !!searchParams.get("search");

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(overrides)) {
      if (val) params.set(key, val);
      else params.delete(key);
    }
    params.delete("page"); // Reset pagination on filter change
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function navigate(overrides: Record<string, string | undefined>) {
    router.push(buildUrl(overrides) as "/activities");
    setOpenPill(null);
  }

  const togglePill = useCallback((pill: OpenPill) => {
    setOpenPill((prev) => (prev === pill ? null : pill));
  }, []);

  // Labels
  const categoryLabel = currentCategoryIds.length === 0
    ? t("categoryLabel")
    : currentCategoryIds.length === 1
    ? getTranslatedField(categories.find((c) => c.id === currentCategoryIds[0])?.name as unknown as TranslatedField, locale)
    : `${currentCategoryIds.length} ${t("categoryLabel").toLowerCase()}`;

  const neighborhoodLabel = currentNeighborhood || t("neighborhood");

  const sortLabelKeys: Record<string, string> = {
    relevance: "sortRelevance",
    rating: "sortRating",
    newest: "sortNewest",
    price_asc: "sortPriceAsc",
    price_desc: "sortPriceDesc",
  };
  const sortLabel = t(sortLabelKeys[currentSort] || "sortRating");

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {/* Category pill */}
      <FilterPill
        label={categoryLabel}
        isActive={currentCategoryIds.length > 0}
        isOpen={openPill === "category"}
        onToggle={() => togglePill("category")}
      >
        <CategoryDropdown
          categories={categories}
          selected={currentCategoryIds}
          locale={locale}
          onApply={(ids) => navigate({ category: ids.length > 0 ? ids.join(",") : undefined })}
        />
      </FilterPill>

      {/* Neighborhood pill */}
      <FilterPill
        label={neighborhoodLabel}
        isActive={!!currentNeighborhood}
        isOpen={openPill === "neighborhood"}
        onToggle={() => togglePill("neighborhood")}
      >
        <NeighborhoodDropdown
          neighborhoods={neighborhoods}
          selected={currentNeighborhood}
          onApply={(n) => navigate({ neighborhood: n || undefined })}
        />
      </FilterPill>

      {/* Sort pill */}
      <FilterPill
        label={sortLabel}
        isActive={currentSort !== "rating" && !(hasSearch && currentSort === "relevance")}
        isOpen={openPill === "sort"}
        onToggle={() => togglePill("sort")}
      >
        <SortDropdown
          current={currentSort}
          hasSearch={hasSearch}
          onApply={(s) => navigate({ sort: s !== "rating" ? s : undefined })}
        />
      </FilterPill>

      {/* More Filters pill */}
      <button
        type="button"
        onClick={() => setOpenPill(openPill === "more" ? null : "more")}
        className="flex items-center gap-1.5 rounded-full border border-charcoal-lighter/30 bg-white px-4 py-2 text-sm font-medium text-charcoal hover:shadow-card whitespace-nowrap transition-all"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        {t("moreFilters")}
      </button>

      <MoreFiltersModal
        open={openPill === "more"}
        onClose={() => setOpenPill(null)}
        dateFrom={searchParams.get("dateFrom") || ""}
        dateTo={searchParams.get("dateTo") || ""}
        minPrice={searchParams.get("minPrice") || ""}
        maxPrice={searchParams.get("maxPrice") || ""}
        search={searchParams.get("search") || ""}
        onApply={(f) => navigate({
          dateFrom: f.dateFrom || undefined,
          dateTo: f.dateTo || undefined,
          minPrice: f.minPrice || undefined,
          maxPrice: f.maxPrice || undefined,
          search: f.search || undefined,
        })}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/activities/search/filter-pill-bar.tsx
git commit -m "feat: add FilterPillBar orchestrating all filter pill dropdowns"
```

---

## Task 8: ActivitySearchBar orchestrator + page.tsx integration

This is the main integration task that wires everything together and updates the page.

**Files:**
- Create: `src/components/activities/search/activity-search-bar.tsx`
- Modify: `src/app/[locale]/activities/page.tsx`

- [ ] **Step 1: Create ActivitySearchBar**

Create `src/components/activities/search/activity-search-bar.tsx`:

```tsx
"use client";

import { ExpandedSearchBar } from "./expanded-search-bar";
import { CollapsedSearchBar } from "./collapsed-search-bar";
import { FilterPillBar } from "./filter-pill-bar";
import type { Category } from "@/lib/types/database";

interface ActivitySearchBarProps {
  hasActiveFilters: boolean;
  categories: Category[];
  neighborhoods: string[];
  locale: string;
}

export function ActivitySearchBar({
  hasActiveFilters,
  categories,
  neighborhoods,
  locale,
}: ActivitySearchBarProps) {
  if (!hasActiveFilters) {
    return (
      <div className="mb-8">
        <ExpandedSearchBar neighborhoods={neighborhoods} />
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      <CollapsedSearchBar neighborhoods={neighborhoods} locale={locale} />
      <FilterPillBar categories={categories} neighborhoods={neighborhoods} locale={locale} />
    </div>
  );
}
```

- [ ] **Step 2: Update page.tsx**

Modify `src/app/[locale]/activities/page.tsx`. Replace the entire file content:

```tsx
import dynamic from "next/dynamic";
import { getTranslations, getLocale } from "next-intl/server";
import { ActivityGrid } from "@/components/activities/activity-grid";
import { ActivitySearchBar } from "@/components/activities/search/activity-search-bar";
import { ViewToggle } from "@/components/activities/view-toggle";
import { ActivityCalendarView } from "@/components/activities/activity-calendar-view";
import { Pagination } from "@/components/ui/pagination";
import { SaveSearchButton } from "@/components/search/save-search-button";
import { getUser } from "@/lib/supabase/get-user";
import {
  fetchActivities,
  buildActivityQuery,
  fetchNeighborhoods,
} from "@/lib/queries/activities";
import { fetchCategories } from "@/lib/queries/categories";
import type { ActivitySort as SortType } from "@/lib/queries/activities";

const ActivityMap = dynamic(
  () =>
    import("@/components/activities/activity-map").then(
      (mod) => mod.ActivityMap
    ),
  { ssr: false }
);

interface BrowsePageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    neighborhood?: string;
    minPrice?: string;
    maxPrice?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    page?: string;
    view?: string;
    calMonth?: string;
  }>;
}

export default async function BrowseActivitiesPage({
  searchParams,
}: BrowsePageProps) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("activities");

  const [categories, neighborhoods, currentUser] = await Promise.all([
    fetchCategories(),
    fetchNeighborhoods(),
    getUser(),
  ]);

  const hasActiveFilters = !!(
    params.search ||
    params.category ||
    params.neighborhood ||
    params.minPrice ||
    params.maxPrice ||
    params.dateFrom ||
    params.dateTo
  );

  const viewMode = params.view === "map" ? "map" : params.view === "calendar" ? "calendar" : "list";
  const isFullFetch = viewMode === "map" || viewMode === "calendar";
  const categoryIds = (params.category || "").split(",").filter(Boolean);

  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth();
  if (params.calMonth && /^\d{4}-\d{2}$/.test(params.calMonth)) {
    const [y, m] = params.calMonth.split("-").map(Number);
    calYear = y;
    calMonth = m - 1;
  }

  const filters = buildActivityQuery({
    categoryIds,
    neighborhood: params.neighborhood,
    minPrice: params.minPrice ? parseInt(params.minPrice) * 100 : undefined,
    maxPrice: params.maxPrice ? parseInt(params.maxPrice) * 100 : undefined,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    search: params.search,
    sort: (params.sort as SortType) || (params.search ? "relevance" : "rating"),
    limit: isFullFetch ? 200 : 12,
    offset: isFullFetch ? 0 : params.page ? (parseInt(params.page) - 1) * 12 : 0,
  });

  const { data: activities, count } = await fetchActivities(filters);
  const perPage = 12;
  const currentPage = params.page ? parseInt(params.page) : 1;
  const totalPages = Math.ceil(count / perPage);

  const selectedDate =
    viewMode === "calendar" && params.dateFrom && params.dateFrom === params.dateTo
      ? params.dateFrom
      : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Search bar (two-state: expanded or collapsed + pills) */}
      <ActivitySearchBar
        hasActiveFilters={hasActiveFilters}
        categories={categories}
        neighborhoods={neighborhoods}
        locale={locale}
      />

      {/* Results info bar (only in results state) */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <p className="text-sm text-charcoal-lighter">
            {t("resultsCount", { count })}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <SaveSearchButton isAuthed={!!currentUser} />
            <ViewToggle />
          </div>
        </div>
      )}

      {/* Content */}
      {activities.length > 0 ? (
        viewMode === "map" ? (
          <ActivityMap activities={activities} locale={locale} />
        ) : viewMode === "calendar" ? (
          <>
            <ActivityCalendarView
              activities={activities}
              locale={locale}
              year={calYear}
              month={calMonth}
              selectedDate={selectedDate}
            />
            <ActivityGrid activities={activities} locale={locale} />
          </>
        ) : (
          <>
            <ActivityGrid activities={activities} locale={locale} />
            <Pagination currentPage={currentPage} totalPages={totalPages} />
          </>
        )
      ) : (
        <div className="text-center py-16">
          <p className="text-lg text-charcoal-lighter">
            {t("noActivities")}
          </p>
          <p className="text-sm text-charcoal-lighter mt-2">
            {t("noActivitiesDesc")}
          </p>
        </div>
      )}
    </div>
  );
}
```

Key changes from the original:
- Removed imports: `ActivityFilters`, `ActivitySort`, `SearchBar`
- Added import: `ActivitySearchBar`
- Added `hasActiveFilters` computation
- Replaced `<h1>`, `<SearchBar>`, `<ActivityFilters>` with `<ActivitySearchBar>`
- Removed `<ActivitySort>` from the results bar (now inside `FilterPillBar`)
- Conditionally show results bar only when `hasActiveFilters` is true

- [ ] **Step 3: Verify the app builds**

Run: `cd hobby-marketplace && npx next build 2>&1 | tail -20`
Expected: Build succeeds. Fix any import errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/activities/search/activity-search-bar.tsx src/app/[locale]/activities/page.tsx
git commit -m "feat: integrate ActivitySearchBar into /activities page

Replace SearchBar + ActivityFilters + ActivitySort with two-state
Airbnb-style search bar. Landing shows expanded Where/When/Price.
Results show collapsed summary + filter pill bar."
```

---

## Task 9: Mobile bottom sheet integration for filter pills

The `FilterPill` component currently only renders desktop dropdowns. This task adds mobile bottom sheet rendering.

**Files:**
- Modify: `src/components/activities/search/filter-pill.tsx`
- Modify: `src/components/activities/search/filter-pill-bar.tsx`

- [ ] **Step 1: Update FilterPill to support mobile bottom sheets**

Replace the content of `src/components/activities/search/filter-pill.tsx`:

```tsx
"use client";

import { useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "./bottom-sheet";

interface FilterPillProps {
  label: string;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  sheetTitle: string;
  children: ReactNode;
  mobileContent?: ReactNode;
}

export function FilterPill({ label, isActive, isOpen, onToggle, sheetTitle, children, mobileContent }: FilterPillProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all whitespace-nowrap",
            isActive
              ? "border-charcoal bg-charcoal/5 text-charcoal"
              : "border-charcoal-lighter/30 bg-white text-charcoal hover:shadow-card",
            isOpen && "shadow-card-hover border-charcoal"
          )}
        >
          {label}
          <svg
            className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Desktop dropdown */}
        {isOpen && (
          <div className="absolute left-0 top-full z-40 mt-2 hidden md:block">
            {children}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      <BottomSheet open={isOpen} onClose={onToggle} title={sheetTitle}>
        {mobileContent || children}
      </BottomSheet>
    </>
  );
}
```

- [ ] **Step 2: Update FilterPillBar to pass sheetTitle**

In `src/components/activities/search/filter-pill-bar.tsx`, update each `<FilterPill>` to include the `sheetTitle` prop. Find the three `<FilterPill` JSX elements and add:

For the Category pill, add `sheetTitle={t("categoryLabel")}`.
For the Neighborhood pill, add `sheetTitle={t("neighborhood")}`.
For the Sort pill, add `sheetTitle={t("sortBy")}`.

- [ ] **Step 3: Commit**

```bash
git add src/components/activities/search/filter-pill.tsx src/components/activities/search/filter-pill-bar.tsx
git commit -m "feat: add mobile bottom sheet support to filter pills"
```

---

## Task 10: Add scrollbar-hide utility + final polish

**Files:**
- Modify: `src/app/globals.css` (or equivalent global CSS)

- [ ] **Step 1: Add scrollbar-hide utility class**

Check if `globals.css` already has a scrollbar-hide class. If not, add to the global CSS file:

```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

This is used by `FilterPillBar` for horizontal scroll on mobile without visible scrollbar.

- [ ] **Step 2: Run the dev server and manually verify**

Run: `cd hobby-marketplace && npm run dev`

Manual checks:
1. Navigate to `/activities` — should see expanded search bar (landing state)
2. Select a neighborhood + date, click Search — should see collapsed bar + filter pills (results state)
3. Click collapsed bar — should open expanded bar overlay with pre-filled values
4. Click Category pill — should open dropdown with category chips
5. Click More Filters — should open modal with date/price/search
6. Resize to mobile width — "Start your search" button should appear, tapping opens full-screen overlay
7. In mobile results state — filter pills should scroll horizontally, tapping opens bottom sheets
8. Switch locale to /en, /es — labels should be translated
9. Map view toggle should still work
10. Save Search button should still appear when filters are active

- [ ] **Step 3: Run existing tests to confirm nothing is broken**

Run: `cd hobby-marketplace && npm test 2>&1 | tail -10`
Expected: All existing tests pass. No backend changes were made.

- [ ] **Step 4: Commit any polish fixes**

```bash
git add -A
git commit -m "chore: add scrollbar-hide utility + polish"
```

---

## Task 11: Final review and cleanup

- [ ] **Step 1: Remove unused imports from page.tsx**

Verify that `activity-filters.tsx` and `activity-sort.tsx` are no longer imported anywhere in the activities page. They may still be imported by other pages — check with:

Run: `grep -r "activity-filters\|activity-sort\|ActivityFilters\|ActivitySort" src/ --include="*.tsx" --include="*.ts"`

If only the original files and their own definitions show up, they're safe to leave (they're not imported). If other pages import them, leave them as-is.

- [ ] **Step 2: Commit cleanup if needed**

```bash
git add -A
git commit -m "chore: cleanup unused imports after search/filter redesign"
```
