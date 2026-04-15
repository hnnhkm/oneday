# "What"-First Top Bar + Search-Stomp Fix on /activities

## Overview

Two coupled changes to the `/activities` search page, kept narrow:

1. **Fix a bug** where the top search bar's magnifying-glass "Search" button rebuilt the URL from scratch, destroying every filter managed by the pill row below (multi-selected neighborhoods, categories, sort, time-of-day, and the price/duration/people ranges from the modal).
2. **Rename the top-bar "Where" segment to "What"** — category multi-select — because users come to a hobby marketplace primarily asking "what can I do?" rather than "what neighborhood?". Neighborhood filtering stays exactly where it already is, in the pill row below.

**Explicitly out of scope (preserved as-is):**
- The magnifying-glass Search button stays. All commits remain click-to-commit — no live URL updates.
- `ActivityFiltersPanel` (the pill row) is untouched — its popovers, modal, sort menu, and commit behavior stay exactly as they are.

## Root Cause of the Bug

Two different UIs write to the same `?neighborhood=` URL param:

- `ExpandedSearchBar` (top pill bar) — single-select. Its `handleSearch` builds a URL from an empty `URLSearchParams`, copying only four fields (`neighborhood`, `dateFrom`, `dateTo`, `minPeople`) from its stale internal state. Every click of the magnifying glass erases every other param.
- `ActivityFiltersPanel` (pill row below) — multi-select via checkbox popover. Correctly merges into the existing URL.

Further, `ExpandedSearchBar`'s internal state initializes from `searchParams` once and never re-syncs, so multi-selections made in the pill row are invisible to it. Even if we fixed the merge, the "Where" single-select would still stomp a multi-select from the pill row every time it committed.

The structural fix: stop writing to `?neighborhood=` from the top bar at all. The top bar's first segment becomes "What" (writes `?category=`), and neighborhood ownership sits entirely in `ActivityFiltersPanel`. One param, one UI.

## Interaction Model

### Top bar — `ExpandedSearchBar` (desktop)

Three segments: **What / When / Who**. Magnifying-glass Search button on the right — unchanged.

| Segment | Empty label | Filled label | Popover content |
|---------|-------------|--------------|-----------------|
| What | "Select activity" | single category name (1), "N categories" (2+) | Multi-select checkbox list of all categories (localized names, alphabetical). Header row with "Select all" and "Clear" text links. |
| When | "Add dates" | "Apr 17" or "Apr 17 – Apr 19" | Existing `DatePanel` (quick picks + manual calendar) — unchanged. |
| Who | "Select people" | "2 people" | Existing `PeoplePanel` stepper — unchanged. |

**Commit behavior:** unchanged. Popover interactions only mutate local component state; the URL updates exactly when the user clicks the magnifying-glass button. No debounce, no live updates.

### Filter pill row — `ActivityFiltersPanel` (desktop)

Unchanged. Still owns Category / Neighborhood / Time-of-day popovers, Sort menu, and the "More filters" modal.

### Mobile overlay — `SearchOverlay`

Three stacked cards: What (new, replacing Where), When, Who. Commit-on-button-click preserved — the footer's "Show results" button still triggers the same `onSearch` flow.

## Architecture

### New component

`src/components/activities/search/category-panel.tsx`

- Props: `{ categories: Category[], locale: string, selectedIds: string[], onToggle(id: string): void, onSelectAll(): void, onClear(): void }`.
- Renders: header row with "Select all" / "Clear" text links, alphabetical checkbox list using `getTranslatedField` for localized category names.
- Mirrors the visual pattern of the neighborhood multi-select popover in `ActivityFiltersPanel` so the two popovers feel consistent.

### Modified components

**`ExpandedSearchBar`**
- State shape: `{ categoryIds: string[], dateFrom, dateTo, people }`. `neighborhood` removed.
- `useEffect([searchParams])`: resync local state from URL on every URL change (fixes the stale-state bug — if the user edits filters elsewhere, the top bar reflects that).
- `handleSearch` rewritten: start from `new URLSearchParams(searchParams.toString())` (merge, not rebuild). For each managed key (`category`, `dateFrom`, `dateTo`, `minPeople`), set if present or delete if empty. Preserves every other param (`neighborhood`, `sort`, `timeOfDay`, range keys, etc.). Also deletes `page` — any filter change invalidates pagination.
- Swaps `NeighborhoodPanel` import for `CategoryPanel`.
- The magnifying-glass button and its wrapper stay.

**`SearchOverlay`**
- Swap the `where` card for a `what` card.
- Props: `neighborhood: string` → `categoryIds: string[]`; `onNeighborhoodChange: (v: string) => void` → `onCategoriesChange: (ids: string[]) => void`.
- `handleClear` updated to clear `categoryIds` alongside the existing fields.
- `onSearch` prop unchanged — the footer button still commits.

**`activity-search-bar.tsx`**
- Props: `{ neighborhoods: string[] }` → `{ categories: Category[], locale: string }`.
- Reads `searchParams.get("category")` (CSV) for initial category IDs.
- Drops the `initialNeighborhood` prop it passed to `ExpandedSearchBar`; passes `initialCategoryIds` instead.

**`activities/page.tsx`**
- Swaps `<ActivitySearchBar neighborhoods={neighborhoods} />` for `<ActivitySearchBar categories={categories} locale={locale} />`.
- `fetchNeighborhoods()` is still called — it still feeds `ActivityFiltersPanel`.

### Deleted component

`src/components/activities/search/neighborhood-panel.tsx` — after the changes above, its last callers (`ExpandedSearchBar`, `SearchOverlay`) no longer import it. `ActivityFiltersPanel` uses its own inline checkbox popover, not this component.

## i18n

Three translation files (`en.json`, `pt.json`, `es.json`) get new keys under the existing search namespace:

- `searchWhat` — segment label ("What" / "O que" / "Qué")
- `selectActivity` — placeholder ("Select activity" / "Escolha uma atividade" / "Selecciona actividad")
- `categoriesCount` — filled label for 2+ selected categories, with ICU `{count}` plural ("{count} categories" / "{count} categorias" / "{count} categorías")
- `selectAll` — link text ("Select all" / "Selecionar tudo" / "Seleccionar todo")

Existing `searchWhere` / `searchByNeighborhood` / `allNeighborhoodsShort` keys become unused — leave them in place for now (deleting i18n keys belongs in a separate cleanup PR).

## Testing

### Manual verification

Run the dev server and check:

1. **Bug regression (primary)** — navigate to `?neighborhood=a,b&category=X&sort=newest&timeOfDay=morning` manually. Open the top bar, change any segment, click the magnifying glass. All four URL params survive; `category` reflects the new selection.
2. **What multi-select** — open the What popover, tick two categories, click the Search button. URL contains `?category=id1,id2`. Label reads "2 categories".
3. **Select all / Clear** — click "Select all" in the popover: all checkboxes tick, segment label shows "N categories". Click "Clear": all unchecked, label returns to "Select activity". Search button commits the empty selection (removes `category` from URL).
4. **URL → state sync** — with the What popover showing 2 categories selected, open the pill-row Category popover and add a third category (via its existing flow). The top bar's What segment label updates to "3 categories" without a full reload.
5. **Mobile overlay** — resize viewport under 768 px, open the overlay, multi-select categories, tap "Show results". URL reflects the selections.
6. **Three locales** — switch locale via URL (`/pt/activities`, `/es/activities`, `/en/activities`); new labels render in each.
7. **No stomp with pill row** — select 3 neighborhoods in the pill-row Neighborhood popover, then pick 2 categories in the top bar and click Search. Both filters active simultaneously in the URL and reflected in both UIs.

### Non-goals (explicitly not tested)

- Time-zone correctness of date commits (inherited from existing `DatePanel`; unchanged).
- Accessibility audit of popovers (unchanged from the existing filters panel).
- Live-commit timing — there are no live commits in this spec.

## Scope

- Only `/activities` (the main search page). `/categories/[slug]` uses its own search bar variant and is out of scope.
- `ActivityFiltersPanel` behavior unchanged.
- Magnifying-glass Search button preserved.
- No live URL updates anywhere.
- Delete unused i18n keys: out of scope (cleanup PR later).
- `NeighborhoodPanel` deletion is in scope; no other shared components change.
- No DB, query, or server-side changes.

## Files

**Created**
- `src/components/activities/search/category-panel.tsx`

**Modified**
- `src/app/[locale]/activities/page.tsx`
- `src/components/activities/search/activity-search-bar.tsx`
- `src/components/activities/search/expanded-search-bar.tsx`
- `src/components/activities/search/search-overlay.tsx`
- `src/messages/en.json`
- `src/messages/pt.json`
- `src/messages/es.json`

**Deleted**
- `src/components/activities/search/neighborhood-panel.tsx`
