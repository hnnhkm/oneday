# Airbnb-Style Search & Filter Redesign for /activities

## Overview

Redesign the `/activities` page search and filter UI to follow the Airbnb Experiences two-state pattern. The current form-based filter bar (dropdowns, number inputs, date pickers, explicit "Apply" button) is replaced with a segmented search bar that collapses into a summary pill + filter pill row once filters are active.

## Two-State Pattern

### State determination

Computed server-side in `page.tsx` from URL search params:

```
hasActiveFilters = any of [search, category, neighborhood, minPrice, maxPrice, dateFrom, dateTo] present
```

- `hasActiveFilters === false` -> Landing state
- `hasActiveFilters === true` -> Results state

### Landing state (no filters active)

A centered, multi-segment search bar with three segments:

| Segment | Label | Placeholder | Dropdown content |
|---------|-------|-------------|------------------|
| Where | "Where" | "Search by neighborhood" | List of available neighborhoods from DB |
| When | "When" | "Add dates" | Quick picks (Today, Tomorrow, This weekend) + month calendar |
| Price | "Price" | "Add price range" | Min/max number inputs |

- The bar is a single rounded-pill container with segments separated by vertical dividers (like Airbnb's `Where | When | Who` bar).
- Clicking a segment highlights it (elevated border/shadow) and opens its dropdown panel below.
- A coral Search button sits at the right end of the bar.
- Clicking Search navigates to `/activities?neighborhood=X&dateFrom=Y&dateTo=Z&minPrice=A&maxPrice=B` and the page re-renders in results state.
- The user can fill any combination of segments (all optional). Clicking Search with nothing filled navigates to `/activities` (stays in landing state showing all activities).

**Desktop layout:** Bar is centered, max-width ~700px, with dropdown panels appearing inline below the active segment.

**Mobile layout:** Tapping "Start your search" pill opens a full-screen overlay with stacked expandable cards (Where, When, Price). Each card expands on tap to show its content. Sticky footer with "Clear all" + coral "Search" button. The Where card, when fully expanded, shows a search input + neighborhood list.

### Results state (any filter active)

Two elements replace the expanded bar:

1. **Collapsed search summary bar** - A compact pill showing a summary of active filters:
   - Format: `"{Neighborhood} · {date range} · {price range}"` with sensible defaults ("All neighborhoods", "Anytime", omit price if not set)
   - Clicking it opens the expanded search bar as an overlay, pre-filled with current filter values, so the user can edit their search rather than starting over
   - A search icon button on the right (coral, circular)
   - The `view` and `page` URL params are preserved across state transitions

2. **Filter pill bar** - Horizontal row of pill-shaped buttons below the summary bar:

| Pill | Behavior | Dropdown type |
|------|----------|---------------|
| Category | Multi-select category chips with icons | Desktop: dropdown. Mobile: bottom sheet |
| Neighborhood | Single-select neighborhood list | Desktop: dropdown. Mobile: bottom sheet |
| Sort | Single-select sort options | Desktop: dropdown. Mobile: bottom sheet |
| More Filters | Date range, price range, text search | Desktop: centered modal. Mobile: full-screen bottom sheet |

**Pill visual states:**
- Default: white background, charcoal border, charcoal text
- Active (has selection): charcoal background, white text (or subtle highlight)
- Open: elevated shadow, slight border change

**Dropdown footer pattern** (consistent across all dropdowns/sheets):
- Left: "Clear" text button (resets that filter)
- Right: "Show results" button (charcoal/dark background, white text). No live count in v1 — just "Show results". Live count can be added later via a count-only API.
- Clicking "Show results" applies the filter and closes the dropdown

**Mobile collapsed bar:** Single centered pill with summary text. Back arrow on left (navigates to landing). Filter sliders icon on right (opens the More Filters sheet directly).

**Mobile pill bar:** Horizontal scroll, no wrapping.

## Component Architecture

### New components (all in `src/components/activities/search/`)

| Component | File | Purpose |
|-----------|------|---------|
| `ActivitySearchBar` | `activity-search-bar.tsx` | Two-state orchestrator. Renders expanded or collapsed based on `hasActiveFilters` prop. |
| `ExpandedSearchBar` | `expanded-search-bar.tsx` | The three-segment bar (Where/When/Price) with dropdown panels. Desktop inline, mobile full-screen overlay. |
| `NeighborhoodPanel` | `neighborhood-panel.tsx` | Dropdown for "Where" segment. Lists neighborhoods. |
| `DatePanel` | `date-panel.tsx` | Dropdown for "When" segment. Quick picks + calendar. |
| `PricePanel` | `price-panel.tsx` | Dropdown for "Price" segment. Min/max inputs. |
| `CollapsedSearchBar` | `collapsed-search-bar.tsx` | Compact summary pill with search icon. Click returns to landing. |
| `FilterPillBar` | `filter-pill-bar.tsx` | Horizontal row of filter pills. |
| `FilterPill` | `filter-pill.tsx` | Individual pill button with chevron, manages open/close state. |
| `CategoryDropdown` | `category-dropdown.tsx` | Grid of category chips with icons. Footer: Clear + Show N results. |
| `NeighborhoodDropdown` | `neighborhood-dropdown.tsx` | List of neighborhoods for the filter pill (single-select). |
| `SortDropdown` | `sort-dropdown.tsx` | Sort options (rating, newest, price asc/desc, relevance). |
| `MoreFiltersModal` | `more-filters-modal.tsx` | Modal (desktop) / full-screen sheet (mobile) with: date range, price range, text search. |
| `DropdownFooter` | `dropdown-footer.tsx` | Shared "Clear" + "Show N results" footer used by all dropdowns. |
| `QuickDatePicks` | `quick-date-picks.tsx` | "Today", "Tomorrow", "This weekend" pill buttons for the date panel. |

### Components to remove

- `src/components/activities/activity-filters.tsx` - replaced by the new search bar + filter pill system
- `src/components/activities/activity-sort.tsx` - absorbed into `SortDropdown` pill
- The `SearchBar` import on the activities page - absorbed into `ExpandedSearchBar` (the homepage `SearchBar` remains untouched for now)

### Components unchanged

- `ActivityGrid`, `ActivityMap`, `ActivityCalendarView`, `Pagination`, `ViewToggle`, `SaveSearchButton`

## Page Layout Changes

### `page.tsx` modifications

The server component changes:

```
Before:
  <h1>Browse title</h1>
  <SearchBar />
  <ActivityFilters />
  <Sort + ViewToggle + SaveSearch row>
  <Grid/Map/Calendar>
  <Pagination>

After:
  <ActivitySearchBar
    hasActiveFilters={hasActiveFilters}
    categories={categories}
    neighborhoods={neighborhoods}
    locale={locale}
    resultCount={count}
  />
  {hasActiveFilters && (
    <div> (sort info + view toggle + save search) </div>
  )}
  <Grid/Map/Calendar>
  <Pagination>
```

The `<h1>` browse title is removed — the search bar IS the hero in landing state. In results state, the result count moves into the filter pill bar area or below it alongside the view toggle.

## Data Flow

No changes to the backend query layer. All filters continue to use URL search params. The `fetchActivities` function and `buildActivityQuery` helper remain as-is.

**Filter application flow:**
1. User interacts with a dropdown (selects category, picks date, etc.)
2. Dropdown shows live "Show N results" count (this requires a lightweight count-only fetch or client-side estimation — see open decision below)
3. User clicks "Show N results"
4. Component builds new URLSearchParams and calls `router.push()`
5. Next.js server component re-renders with new params
6. `fetchActivities` runs with updated filters

**"Show N results" count strategy:**
- **Option A (simpler, recommended):** The count shown is the current page's `count` prop passed down. When the user changes a filter in the dropdown, the button just says "Show results" without a live count. This avoids extra fetch requests.
- **Option B (faithful to Airbnb):** Each dropdown does a client-side fetch to a lightweight `/api/activities/count` endpoint that returns only the count for the current filter combination. More complex, adds an API route.

**Recommendation:** Start with Option A. Add live counts later if needed.

## Styling

All new components use the existing Tailwind design tokens:

- **Primary coral** (`primary-400` / `primary-500`) for the Search button and active highlights
- **Charcoal** (`charcoal` / `charcoal-light` / `charcoal-lighter`) for text, borders, pill outlines
- **Background** (`background-DEFAULT` / `background-card`) for surfaces
- **Shadows** (`shadow-card`, `shadow-dropdown`) for elevated panels
- **Border radius** (`rounded-full` for pills, `rounded-lg` for dropdown panels)

The design philosophy (Gentle Threshold) is respected: generous spacing, warm tones, rounded forms, unhurried rhythm.

**Pill button styling:**
- Default: `bg-white border border-charcoal-lighter/30 rounded-full px-4 py-2 text-sm text-charcoal`
- Active: `bg-charcoal text-white` or `border-charcoal bg-charcoal/5`
- Hover: `shadow-card-hover`

**Dropdown panels:**
- `bg-white rounded-lg shadow-dropdown border border-charcoal-lighter/10 p-4`
- Max-width constrained, positioned below the pill that opened it

**Category chips (inside CategoryDropdown):**
- `border border-charcoal-lighter/30 rounded-full px-3 py-2 text-sm` with icon + label
- Selected: `border-charcoal bg-charcoal/5 font-medium`
- Flex-wrap grid layout

## Responsive Behavior

| Element | Desktop (>=768px) | Mobile (<768px) |
|---------|-------------------|-----------------|
| Landing search bar | Inline 3-segment pill, centered | "Start your search" button -> full-screen overlay with stacked cards |
| Segment dropdowns | Appear below the segment inline | Cards expand within the full-screen overlay |
| Collapsed bar | Centered pill with summary text | Centered pill with summary, back arrow left, filter icon right |
| Filter pills | Horizontal flex row | Horizontal scroll, `overflow-x-auto` |
| Category/Neighborhood/Sort dropdown | Positioned dropdown below pill | Bottom sheet (slide up from bottom, rounded top corners) |
| More Filters | Centered modal with backdrop | Full-screen bottom sheet |

**Bottom sheet pattern (mobile):**
- Slides up from bottom with rounded top corners (`rounded-t-xl`)
- Semi-transparent backdrop
- Sticky header with title + X close button
- Scrollable content area
- Sticky footer with "Clear all" + "Show N results"

## i18n

New translation keys needed in `src/messages/{pt,en,es}.json` under the `"activities"` namespace:

- `searchWhere`: "Where" / "Onde" / "Donde"
- `searchWhen`: "When" / "Quando" / "Cuando"
- `searchPrice`: "Price" / "Preco" / "Precio"
- `searchByNeighborhood`: "Search by neighborhood"
- `addDates`: "Add dates"
- `addPriceRange`: "Add price range"
- `startSearch`: "Start your search"
- `today`: "Today"
- `tomorrow`: "Tomorrow"
- `thisWeekend`: "This weekend"
- `anytime`: "Anytime"
- `showResults`: "Show {count} results"
- `clearAll`: "Clear all"
- `moreFilters`: "More filters"
- `allNeighborhoodsShort`: "All neighborhoods" (for collapsed bar summary)
- `categoryLabel`: "Category" (pill label)

Existing keys reused: `allCategories`, `neighborhood`, `priceRange`, `dateRange`, `sortBy`, `sortRating`, `sortNewest`, `sortPriceAsc`, `sortPriceDesc`, `sortRelevance`, `clearFilters`, `minPrice`, `maxPrice`.

## Testing

- Existing tests for `fetchActivities`, `buildActivityQuery`, pagination, and search normalization are unaffected (no backend changes).
- No new unit tests needed for the UI components — they are presentational wrappers around URL param manipulation, which is already tested via the query layer.
- Manual testing checklist:
  - Landing state renders expanded bar with no filters
  - Each segment opens its dropdown on click
  - Search navigates to results state with correct params
  - Results state shows collapsed bar + filter pills
  - Each pill opens correct dropdown with current selection
  - Dropdown footer "Show results" applies filter and closes
  - "Clear" in dropdown removes that specific filter
  - Clicking collapsed bar returns to landing state
  - Mobile: full-screen overlay for landing, bottom sheets for results
  - All three locales display correctly
  - Map view and list view toggle work in results state
  - Save Search button still works
  - URL is bookmarkable/shareable in both states

## Scope exclusions

- **No changes to the homepage** — the existing homepage `SearchBar` stays as-is. A future task could replace it with the expanded search bar.
- **No live "Show N results" count** — start with static "Show results" button. Add count-only API later.
- **No horizontal category carousels** — results stay as the existing grid layout.
- **No animation/transitions** between states — URL-driven page loads. CSS transitions within dropdowns (open/close) are fine.
- **No "Originals" pill** — Airbnb-specific concept that doesn't map to this app.
