# "What"-First Top Bar + Search-Stomp Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the top-bar "Where" segment on `/activities` to "What" (category multi-select), fix the `handleSearch` bug where clicking Search erases every param it doesn't own, and delete the now-unused `NeighborhoodPanel` component.

**Architecture:** The top bar's first segment switches from a single-select neighborhood list (which also stomped the URL on commit) to a multi-select category popover. `handleSearch` is rewritten to merge into the current `URLSearchParams` instead of rebuilding from scratch, and a new `useEffect` keeps component state in sync with URL changes. `ActivityFiltersPanel` (the pill row below) is untouched — it already owns neighborhood filtering.

**Tech Stack:** Next.js 14 App Router, React (client components), next-intl for translations, TypeScript, Jest + React Testing Library.

---

## File Structure

**New:**
- `src/components/activities/search/category-panel.tsx` — multi-select checkbox popover for categories (header with "Select all" / "Clear", alphabetical checkbox list).

**Modified:**
- `src/components/activities/search/expanded-search-bar.tsx` — swap Where segment for What; change state from `neighborhood: string` to `categoryIds: string[]`; add URL sync `useEffect`; rewrite `handleSearch` to merge.
- `src/components/activities/search/search-overlay.tsx` — swap Where card for What card; rename props.
- `src/components/activities/search/activity-search-bar.tsx` — props `{ neighborhoods }` → `{ categories, locale }`; read `category` from URL.
- `src/app/[locale]/activities/page.tsx` — pass `categories` and `locale` to `ActivitySearchBar`.
- `src/messages/en.json`, `src/messages/pt.json`, `src/messages/es.json` — add `searchWhat`, `selectActivity`, `selectAll`, `categoriesCount` keys.

**Deleted:**
- `src/components/activities/search/neighborhood-panel.tsx` — last callers migrated to `CategoryPanel`.

---

## Task 1: Add i18n keys

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/pt.json`
- Modify: `src/messages/es.json`

Four new keys. `searchWhat` is the segment label; `selectActivity` is the empty-state sublabel; `categoriesCount` is the filled label for 2+ with ICU plural; `selectAll` is the popover link.

- [ ] **Step 1: Add keys to `en.json`**

Open `src/messages/en.json`. Find line 225 (`"searchWhere": "Where"`). Immediately AFTER that line (before `"searchWhen"`) insert:

```json
    "searchWhat": "What",
    "selectActivity": "Select activity",
    "categoriesCount": "{count, plural, one {# category} other {# categories}}",
    "selectAll": "Select all",
```

- [ ] **Step 2: Add keys to `pt.json`**

Open `src/messages/pt.json`. Find line 225 (`"searchWhere": "Onde"`). Immediately AFTER that line insert:

```json
    "searchWhat": "O que",
    "selectActivity": "Escolha uma atividade",
    "categoriesCount": "{count, plural, one {# categoria} other {# categorias}}",
    "selectAll": "Selecionar tudo",
```

- [ ] **Step 3: Add keys to `es.json`**

Open `src/messages/es.json`. Find line 225 (`"searchWhere": "Donde"`). Immediately AFTER that line insert:

```json
    "searchWhat": "Qué",
    "selectActivity": "Selecciona actividad",
    "categoriesCount": "{count, plural, one {# categoría} other {# categorías}}",
    "selectAll": "Seleccionar todo",
```

- [ ] **Step 4: Verify JSON parses cleanly**

Run: `cd hobby-marketplace && node -e "for (const f of ['en','pt','es']) { JSON.parse(require('fs').readFileSync('src/messages/' + f + '.json', 'utf8')); console.log(f, 'ok'); }"`

Expected: three lines — `en ok`, `pt ok`, `es ok`. If any file errors out, fix the trailing comma or missing quote on the inserted block.

- [ ] **Step 5: Commit**

```bash
cd hobby-marketplace
git add src/messages/en.json src/messages/pt.json src/messages/es.json
git commit -m "i18n(activities): add searchWhat/selectActivity/categoriesCount/selectAll keys"
```

---

## Task 2: Create `CategoryPanel` component

**Files:**
- Create: `src/components/activities/search/category-panel.tsx`

Multi-select checkbox popover. Matches the visual density of `NeighborhoodPanel` (tight row buttons) but adds checkbox semantics and a header row. Header has "Select all" on the left and "Clear" on the right as text-link buttons. Body is an alphabetical list of category rows; each row is a button that toggles its checkbox state.

- [ ] **Step 1: Write the component file**

Create `src/components/activities/search/category-panel.tsx` with the following contents:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getTranslatedField } from "@/lib/utils";
import type { Category, TranslatedField } from "@/lib/types/database";

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
    const an = getTranslatedField(a.name as unknown as TranslatedField, locale);
    const bn = getTranslatedField(b.name as unknown as TranslatedField, locale);
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

      {/* Checkbox list */}
      <div className="space-y-1 max-h-[320px] overflow-y-auto">
        {sorted.map((cat) => {
          const checked = selectedIds.includes(cat.id);
          const name = getTranslatedField(
            cat.name as unknown as TranslatedField,
            locale
          );
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onToggle(cat.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                checked
                  ? "bg-background-muted font-medium text-charcoal"
                  : "text-charcoal hover:bg-background-muted/60"
              )}
              aria-pressed={checked}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  checked
                    ? "bg-charcoal border-charcoal text-white"
                    : "border-charcoal-lighter/40"
                )}
                aria-hidden
              >
                {checked && (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </span>
              <span className="truncate">{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd hobby-marketplace && npx tsc --noEmit -p tsconfig.json 2>&1 | grep category-panel || echo "no category-panel errors"`

Expected: `no category-panel errors`. If tsc reports errors in this file, fix them before continuing.

- [ ] **Step 3: Verify lint passes**

Run: `cd hobby-marketplace && npx next lint --file src/components/activities/search/category-panel.tsx`

Expected: no lint errors on this file.

- [ ] **Step 4: Commit**

```bash
cd hobby-marketplace
git add src/components/activities/search/category-panel.tsx
git commit -m "feat(search): add CategoryPanel multi-select popover"
```

---

## Task 3: Wire `CategoryPanel` into `ExpandedSearchBar`

**Files:**
- Modify: `src/components/activities/search/expanded-search-bar.tsx`

Four sub-changes: (a) props + imports, (b) state swap `neighborhood → categoryIds`, (c) URL-sync `useEffect`, (d) rewrite `handleSearch` to merge, (e) replace the "where" segment UI and pass new props to `SearchOverlay`. The "when" and "who" segments are unchanged.

- [ ] **Step 1: Replace imports and props**

Open `src/components/activities/search/expanded-search-bar.tsx`.

Replace lines 1–21 (from `"use client";` through the `interface ExpandedSearchBarProps` block, ending `}`):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
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
}
```

- [ ] **Step 2: Replace the component signature and state block**

Replace the function signature block (the old lines 23–41, from `export function ExpandedSearchBar({` through the `const [mobileOpen, setMobileOpen] = useState(false);` line) with:

```tsx
export function ExpandedSearchBar({
  categories,
  locale,
  initialCategoryIds = [],
  initialDateFrom = "",
  initialDateTo = "",
  initialPeople = "",
}: ExpandedSearchBarProps) {
  const t = useTranslations("activities");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeSegment, setActiveSegment] = useState<Segment>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>(initialCategoryIds);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [people, setPeople] = useState<number>(
    initialPeople ? Math.max(0, parseInt(initialPeople) || 0) : 0
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  // Keep internal state in sync with URL changes from elsewhere
  // (e.g. the filter pill row below, back/forward nav). Without this
  // the top bar shows stale selections and would clobber them when
  // `handleSearch` writes back.
  useEffect(() => {
    const cat = searchParams.get("category") || "";
    setCategoryIds(cat ? cat.split(",").filter(Boolean) : []);
    setDateFrom(searchParams.get("dateFrom") || "");
    setDateTo(searchParams.get("dateTo") || "");
    const p = searchParams.get("minPeople");
    setPeople(p ? Math.max(0, parseInt(p) || 0) : 0);
  }, [searchParams]);
```

- [ ] **Step 3: Rewrite `handleSearch`**

Replace the existing `handleSearch` function (the old lines 68–82, the entire `function handleSearch() { ... }` block including body) with:

```tsx
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

    if (people > 0) params.set("minPeople", String(people));
    else params.delete("minPeople");

    // Any filter change invalidates the current page position.
    params.delete("page");

    const qs = params.toString();
    router.push(`/activities${qs ? `?${qs}` : ""}` as "/activities");
    setMobileOpen(false);
  }
```

- [ ] **Step 4: Replace the What-segment label computation**

Replace the old `neighborhoodLabel` declaration (was around line 88) with the new `categoryLabel` logic. Find the line:

```tsx
  const neighborhoodLabel = neighborhood || t("searchByNeighborhood");
```

Replace with:

```tsx
  const categoryLabel =
    categoryIds.length === 0
      ? t("selectActivity")
      : categoryIds.length === 1
        ? (() => {
            const cat = categories.find((c) => c.id === categoryIds[0]);
            if (!cat) return t("categoriesCount", { count: 1 });
            // Inline import avoids a second top-level import — locale
            // + name handling is only needed here.
            const name = cat.name as unknown as {
              pt?: string;
              en?: string;
              es?: string;
            };
            return (
              name[locale as "pt" | "en" | "es"] || name.pt || name.en || ""
            );
          })()
        : t("categoriesCount", { count: categoryIds.length });
```

- [ ] **Step 5: Update `SearchOverlay` props passed from this component**

Find the `<SearchOverlay ... />` block (around line 113). Replace lines 116–118 (the three lines `neighborhoods={neighborhoods}`, `neighborhood={neighborhood}`, `onNeighborhoodChange={setNeighborhood}`) with:

```tsx
        categories={categories}
        locale={locale}
        categoryIds={categoryIds}
        onCategoriesChange={setCategoryIds}
```

- [ ] **Step 6: Replace the desktop "Where" segment with "What"**

Find the desktop segment block that starts with the comment `{/* Where segment */}` (around line 133) and ends at the matching closing `</div>` before the `{activeSegment !== "where" && ...}` divider (around line 159).

Replace that entire block (the "Where segment" div) with:

```tsx
          {/* What segment */}
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => toggleSegment("what")}
              className={cn(
                "w-full text-left px-6 py-3 rounded-full transition-colors",
                activeSegment === "what" ? "bg-white shadow-card" : "hover:bg-background-muted/80"
              )}
            >
              <div className="text-xs font-semibold text-charcoal">{t("searchWhat")}</div>
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
```

- [ ] **Step 7: Update the segment-divider conditions from "where" to "what"**

Two divider lines reference `"where"` by string. Find them (around lines 161 and 196) and update:

Old (line ~161):
```tsx
          {activeSegment !== "where" && activeSegment !== "when" && (
```

New:
```tsx
          {activeSegment !== "what" && activeSegment !== "when" && (
```

The second divider (`!== "when" && !== "who"`) is unchanged — only "where" references become "what".

- [ ] **Step 8: Run typecheck**

Run: `cd hobby-marketplace && npx tsc --noEmit -p tsconfig.json 2>&1 | grep expanded-search-bar || echo "no expanded-search-bar errors"`

Expected: `no expanded-search-bar errors`. Fix any types before continuing — likely suspects are the `locale` cast or the `name` object shape.

- [ ] **Step 9: Commit**

```bash
cd hobby-marketplace
git add src/components/activities/search/expanded-search-bar.tsx
git commit -m "feat(search): swap top-bar Where for What + fix handleSearch URL merge"
```

---

## Task 4: Update `SearchOverlay` for mobile

**Files:**
- Modify: `src/components/activities/search/search-overlay.tsx`

Swap the Where card for a What card. Adopt the new prop names (`categories`, `locale`, `categoryIds`, `onCategoriesChange`). No live-commit changes — the footer's "Show results" button still triggers `onSearch`.

- [ ] **Step 1: Replace imports and props interface**

Open `src/components/activities/search/search-overlay.tsx`. Replace lines 1–24 (from `"use client";` through the `interface SearchOverlayProps { ... }` closing `}`) with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CategoryPanel } from "./category-panel";
import { DatePanel } from "./date-panel";
import { PeoplePanel } from "./people-panel";
import type { Category, TranslatedField } from "@/lib/types/database";
import { getTranslatedField } from "@/lib/utils";

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
  onDateChange: (from: string, to: string) => void;
  people: number;
  onPeopleChange: (next: number) => void;
  onSearch: () => void;
}
```

- [ ] **Step 2: Update the function signature and `useEffect` initial card**

Replace the function signature block (old lines 26–50, from `export function SearchOverlay({` through the closing `}, [open]);`) with:

```tsx
export function SearchOverlay({
  open,
  onClose,
  categories,
  locale,
  categoryIds,
  onCategoriesChange,
  dateFrom,
  dateTo,
  onDateChange,
  people,
  onPeopleChange,
  onSearch,
}: SearchOverlayProps) {
  const t = useTranslations("activities");
  const [expandedCard, setExpandedCard] = useState<Card>("what");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setExpandedCard("what");
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);
```

- [ ] **Step 3: Update `handleClear`**

Replace the `handleClear` function (old lines 54–58):

```tsx
  function handleClear() {
    onCategoriesChange([]);
    onDateChange("", "");
    onPeopleChange(0);
  }
```

- [ ] **Step 4: Compute a `categoryLabel` for the collapsed card**

Immediately BEFORE the `const dateLabel = ...` line (around old line 60) insert:

```tsx
  const categoryLabel =
    categoryIds.length === 0
      ? t("selectActivity")
      : categoryIds.length === 1
        ? (() => {
            const cat = categories.find((c) => c.id === categoryIds[0]);
            if (!cat) return t("categoriesCount", { count: 1 });
            return getTranslatedField(
              cat.name as unknown as TranslatedField,
              locale
            );
          })()
        : t("categoriesCount", { count: categoryIds.length });
```

- [ ] **Step 5: Replace the Where card with a What card**

Find the `{/* Where card */}` block (old lines 82–107) and replace the entire block (both the collapsed button and the expanded content) with:

```tsx
        {/* What card */}
        <button
          type="button"
          onClick={() => setExpandedCard(expandedCard === "what" ? null : "what")}
          className={cn(
            "w-full bg-white rounded-xl shadow-card text-left transition-all",
            expandedCard !== "what" && "px-5 py-4 flex justify-between items-center"
          )}
        >
          {expandedCard === "what" ? null : (
            <>
              <span className="text-sm text-charcoal-lighter">{t("searchWhat")}</span>
              <span className="text-sm font-medium text-charcoal">{categoryLabel}</span>
            </>
          )}
        </button>
        {expandedCard === "what" && (
          <div className="bg-white rounded-xl shadow-card p-5">
            <h3 className="text-lg font-semibold text-charcoal mb-3">{t("searchWhat")}?</h3>
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
```

- [ ] **Step 6: Typecheck**

Run: `cd hobby-marketplace && npx tsc --noEmit -p tsconfig.json 2>&1 | grep search-overlay || echo "no search-overlay errors"`

Expected: `no search-overlay errors`.

- [ ] **Step 7: Commit**

```bash
cd hobby-marketplace
git add src/components/activities/search/search-overlay.tsx
git commit -m "feat(search): swap mobile overlay Where card for What"
```

---

## Task 5: Update `ActivitySearchBar` wrapper

**Files:**
- Modify: `src/components/activities/search/activity-search-bar.tsx`

Props change from `{ neighborhoods: string[] }` to `{ categories: Category[], locale: string }`. The initial URL read switches from `neighborhood` to `category` (CSV-split).

- [ ] **Step 1: Replace the file contents**

Overwrite `src/components/activities/search/activity-search-bar.tsx` with:

```tsx
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
    <div className="mb-6">
      <ExpandedSearchBar
        categories={categories}
        locale={locale}
        initialCategoryIds={initialCategoryIds}
        initialDateFrom={searchParams.get("dateFrom") || ""}
        initialDateTo={searchParams.get("dateTo") || ""}
        initialPeople={searchParams.get("minPeople") || ""}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd hobby-marketplace && npx tsc --noEmit -p tsconfig.json 2>&1 | grep activity-search-bar || echo "no activity-search-bar errors"`

Expected: `no activity-search-bar errors`.

- [ ] **Step 3: Commit**

```bash
cd hobby-marketplace
git add src/components/activities/search/activity-search-bar.tsx
git commit -m "feat(search): ActivitySearchBar passes categories + locale"
```

---

## Task 6: Update `/activities` page to pass categories

**Files:**
- Modify: `src/app/[locale]/activities/page.tsx`

Only one line changes — the `<ActivitySearchBar />` usage. `fetchCategories()` and `fetchNeighborhoods()` are both already called higher up; no new data fetching.

- [ ] **Step 1: Update the `ActivitySearchBar` call**

Open `src/app/[locale]/activities/page.tsx`. Find line 130:

```tsx
      <ActivitySearchBar neighborhoods={neighborhoods} />
```

Replace with:

```tsx
      <ActivitySearchBar categories={categories} locale={locale} />
```

- [ ] **Step 2: Typecheck**

Run: `cd hobby-marketplace && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "activities/page" || echo "no activities/page errors"`

Expected: `no activities/page errors`.

- [ ] **Step 3: Commit**

```bash
cd hobby-marketplace
git add "src/app/[locale]/activities/page.tsx"
git commit -m "feat(activities): pass categories + locale to ActivitySearchBar"
```

---

## Task 7: Delete `NeighborhoodPanel`

**Files:**
- Delete: `src/components/activities/search/neighborhood-panel.tsx`

With `ExpandedSearchBar` and `SearchOverlay` migrated to `CategoryPanel`, `NeighborhoodPanel` has no callers. `ActivityFiltersPanel` does its neighborhood multi-select inline — it does not import this file.

- [ ] **Step 1: Confirm no remaining callers**

Run: `cd hobby-marketplace && grep -rn "NeighborhoodPanel\|neighborhood-panel" src __tests__ 2>/dev/null || echo "no references"`

Expected: either `no references` or only matches inside `neighborhood-panel.tsx` itself. If any other file imports `NeighborhoodPanel`, STOP — a previous task missed a migration. Go back and fix it before deleting.

- [ ] **Step 2: Delete the file**

Run: `cd hobby-marketplace && git rm src/components/activities/search/neighborhood-panel.tsx`

- [ ] **Step 3: Full typecheck**

Run: `cd hobby-marketplace && npx tsc --noEmit -p tsconfig.json`

Expected: exit code 0, no errors. This catches any lingering reference anywhere in the project.

- [ ] **Step 4: Commit**

```bash
cd hobby-marketplace
git commit -m "refactor(search): remove unused NeighborhoodPanel"
```

---

## Task 8: Full verification

**Files:**
- No file changes — this is a full build/test/lint sweep.

Catches anything missed: unused imports, i18n-key typos, type mismatches that didn't surface on a per-file basis.

- [ ] **Step 1: Run the test suite**

Run: `cd hobby-marketplace && npm test -- --passWithNoTests`

Expected: all tests pass. If a test fails, read the failure carefully — it's more likely a real bug than a harmless snapshot diff. The existing `activity-card.test.tsx` should still pass since we didn't touch it.

- [ ] **Step 2: Run lint**

Run: `cd hobby-marketplace && npm run lint`

Expected: exit code 0, no errors or warnings.

- [ ] **Step 3: Run production build**

Run: `cd hobby-marketplace && npm run build`

Expected: build succeeds. This is the strongest check that i18n keys and types line up.

**IMPORTANT:** If a dev server (`npm run dev`) is running in this repo, STOP it before running `npm run build`. Running both in the same `.next/` directory corrupts dev-server state and can make the site serve 500s. After the build finishes, you can restart `npm run dev` if needed.

- [ ] **Step 4: Manual smoke test (checklist)**

Start the dev server (`cd hobby-marketplace && npm run dev`) and in a browser verify:

1. Navigate to `http://localhost:3000/pt/activities?neighborhood=Consola%C3%A7%C3%A3o&category=X&sort=newest` (replace `X` with any real category id from the pill-row Category popover if you want a realistic test). Open the top-bar What segment, toggle a category, click the magnifying-glass Search button. The URL should still contain `neighborhood=Consolação` and `sort=newest`; only `category` changes.
2. Open the What popover, click "Select all" — all rows tick, segment label becomes `"N categories"`. Click "Clear" — all untick, label returns to "Select activity". Click Search — URL has no `category=` key.
3. Multi-select 3 neighborhoods in the pill-row Neighborhood popover and apply. Then pick 2 categories in the top bar and Search. The URL should show both `neighborhood=a,b,c` (3 names) and `category=id1,id2`.
4. Load `/pt/activities`, `/es/activities`, `/en/activities`. The first segment label reads "O que", "Qué", and "What" respectively.
5. Resize under 768px, open the mobile overlay, multi-select categories, tap "Show results". URL reflects the selections.

- [ ] **Step 5: Final commit (only if any fixes landed in Steps 1–4)**

If any of the verification steps required code changes, commit them now:

```bash
cd hobby-marketplace
git add -u
git commit -m "fix(search): address verification findings"
```

Otherwise skip — no empty commit.
