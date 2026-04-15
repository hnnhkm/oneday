import { createClient } from "@/lib/supabase/server";
import type { Activity, QuorumState } from "@/lib/types/database";
import {
  applyLegacySynthesisToRow,
  pickPrimarySession,
} from "@/lib/queries/session-synthesis";

// Pure validators/types live in a server-free module so client
// components can import them without pulling in next/headers.
// Re-exported here for ergonomics of server consumers.
export {
  validateActivityInput,
  canPublishActivity,
  canDeleteActivity,
  canCancelActivity,
  type ActivityInput,
  type ActivityValidationField,
  type ActivityValidationError,
} from "@/lib/activity-validation";

export type ActivitySort = "newest" | "price_asc" | "price_desc" | "rating" | "relevance";

export type TimeOfDay = "morning" | "afternoon" | "evening";

export interface ActivityFilters {
  status: "published";
  categoryIds?: string[];
  neighborhoods?: string[];
  minPrice?: number;
  maxPrice?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort: ActivitySort;
  limit?: number;
  offset?: number;
  timeOfDay?: TimeOfDay[];
  durationMin?: number;  // minutes
  durationMax?: number;  // minutes
  minPeople?: number;    // matches activities.max_seats
  maxPeople?: number;
}

export interface ActivitySessionSummary {
  id: string;
  starts_at: string;
  ends_at: string;
  max_seats: number;
  seats_remaining: number;
  status: "draft" | "published" | "cancelled" | "completed";
  quorum_state: QuorumState;
  instructor_confirmed_at: string | null;
}

export interface ActivityWithInstructor extends Activity {
  instructor_profiles: {
    id: string;
    user_id: string;
    users: {
      name: string;
      avatar_url: string | null;
    };
  };
  categories: {
    name: Record<string, string>;
    slug: string;
    icon: string;
  };
  avg_rating?: number;
  review_count?: number;
  // Populated by fetchActivityById and sometimes by fetchActivities
  // (via the !inner embed that scopes date/time-of-day filters). May
  // be an empty array during the Phase-3 transition window; callers
  // that need the next bookable session should fall back gracefully.
  activity_sessions?: ActivitySessionSummary[];
}

/**
 * Normalizes a raw user search term before passing it to
 * websearch_to_tsquery via the search_activities_rank RPC. Collapses
 * whitespace, enforces a 2-char minimum, and clamps to 100 chars.
 *
 * Intentionally does NOT strip wildcards, parentheses, or quotes —
 * websearch_to_tsquery is safe against any string input and treats
 * quotes/minus/OR as documented search operators.
 *
 * Returns `null` when the cleaned term is too short to be useful;
 * callers should skip the search filter entirely in that case.
 */
export function normalizeSearchTerm(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length < 2) return null;
  return cleaned.slice(0, 100);
}

/**
 * Pure: sort a row list by descending rank using the rank map,
 * then slice for pagination. Rows missing from the rank map are
 * treated as rank 0 (sorted last). Does not mutate the input.
 */
export function sortByRankAndSlice<T extends { id: string }>(
  rows: T[],
  rankMap: Map<string, number>,
  offset: number,
  limit: number
): T[] {
  const sorted = [...rows].sort(
    (a, b) => (rankMap.get(b.id) ?? 0) - (rankMap.get(a.id) ?? 0)
  );
  return sorted.slice(offset, offset + limit);
}

/**
 * Calls the search_activities_rank RPC and returns a stable
 * {ids, rankMap} view of the result so callers can both:
 *   (a) filter a PostgREST query via .in('id', ids), and
 *   (b) re-sort rows by rank in JS using rankMap.
 *
 * Returns empty ids/rankMap when the RPC errors or returns nothing.
 */
async function searchActivitiesRank(
  term: string
): Promise<{ ids: string[]; rankMap: Map<string, number> }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_activities_rank", { q: term });
  if (error || !data) {
    if (error) console.error("search_activities_rank failed:", error);
    return { ids: [], rankMap: new Map() };
  }
  const ids: string[] = [];
  const rankMap = new Map<string, number>();
  for (const row of data as { id: string; rank: number }[]) {
    ids.push(row.id);
    rankMap.set(row.id, row.rank);
  }
  // The RPC applies LIMIT 500 internally. If this returns exactly 500
  // rows, results may be truncated — acceptable at current inventory
  // scale. If this becomes a problem, push post-filters into the RPC.
  return { ids, rankMap };
}

export function buildActivityQuery(params: {
  categoryIds?: string[];
  neighborhoods?: string[];
  minPrice?: number;
  maxPrice?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: ActivitySort;
  limit?: number;
  offset?: number;
  timeOfDay?: TimeOfDay[];
  durationMin?: number;
  durationMax?: number;
  minPeople?: number;
  maxPeople?: number;
}): ActivityFilters {
  return {
    status: "published",
    categoryIds: params.categoryIds && params.categoryIds.length > 0 ? params.categoryIds : undefined,
    neighborhoods: params.neighborhoods && params.neighborhoods.length > 0 ? params.neighborhoods : undefined,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    search: params.search,
    sort: params.sort || "rating",
    limit: params.limit,
    offset: params.offset,
    timeOfDay: params.timeOfDay && params.timeOfDay.length > 0 ? params.timeOfDay : undefined,
    durationMin: params.durationMin,
    durationMax: params.durationMax,
    minPeople: params.minPeople,
    maxPeople: params.maxPeople,
  };
}

export async function fetchActivities(
  filters: ActivityFilters
): Promise<{ data: ActivityWithInstructor[]; count: number }> {
  const supabase = await createClient();

  // Coerce invalid state: "relevance" sort without a search term
  // falls back to "rating". Keeps the relevance branch tightly
  // gated on actually having a term to rank against.
  const effectiveSort: ActivitySort =
    filters.sort === "relevance" && !filters.search ? "rating" : filters.sort;

  // Resolve search to a ranked id list via the RPC (tsvector path).
  let searchIds: string[] | null = null;
  let rankMap: Map<string, number> | null = null;
  if (filters.search) {
    const term = normalizeSearchTerm(filters.search);
    if (term) {
      const res = await searchActivitiesRank(term);
      if (res.ids.length === 0) {
        return { data: [], count: 0 };
      }
      searchIds = res.ids;
      rankMap = res.rankMap;
    }
  }

  // Phase 2 of activity-sessions split:
  //   Date + time-of-day filters target `activity_sessions` (via the
  //   inner embed) instead of the legacy `activities.date|time`. Today
  //   there's one session per activity (mirror trigger), so behaviour
  //   is identical. Once an instructor adds a second session, activities
  //   show up when ANY of their sessions match — which is the desired
  //   dedup behaviour for the marketplace grid.
  //
  //   `activity_sessions!inner(...)` means: only include activities
  //   that have ≥1 session row matching the embed-scoped filters. The
  //   parent row still appears once regardless of how many sessions
  //   match, so count/pagination are unaffected.
  // Phase 6A: session embed is the source of truth for date/time/max_seats/
  // seats_remaining. We still `select *` from activities so every other
  // column comes through untouched, then overwrite the legacy fields with
  // `applyLegacySynthesisToRow` below. The `!inner` on activity_sessions
  // means activities with zero matching sessions don't appear at all —
  // matching Phase 5 behaviour, where the marketplace only lists things
  // you can actually book.
  let query = supabase
    .from("activities")
    .select(
      `
      *,
      instructor_profiles!inner (
        id,
        user_id,
        users!inner (name, avatar_url)
      ),
      categories!inner (name, slug, icon),
      reviews (rating),
      activity_sessions!inner (
        id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time, quorum_state, instructor_confirmed_at
      )
    `,
      { count: "exact" }
    )
    .eq("status", "published")
    // Only consider sessions that are themselves published (cancelled/
    // completed sessions shouldn't surface the activity on the grid).
    .eq("activity_sessions.status", "published");

  if (searchIds) {
    query = query.in("id", searchIds);
  }

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    query = query.in("category_id", filters.categoryIds);
  }

  if (filters.neighborhoods && filters.neighborhoods.length > 0) {
    query = query.in("neighborhood", filters.neighborhoods);
  }

  if (filters.minPrice !== undefined) {
    query = query.gte("price_cents", filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    query = query.lte("price_cents", filters.maxPrice);
  }

  if (filters.dateFrom) {
    query = query.gte("activity_sessions.local_date", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("activity_sessions.local_date", filters.dateTo);
  }

  // Time of day: morning = time < 12:00, afternoon = 12:00-17:59, evening = >= 18:00
  // (São Paulo wall-clock, via generated local_time column.)
  if (filters.timeOfDay && filters.timeOfDay.length > 0) {
    const ranges = filters.timeOfDay.map((slot) => {
      if (slot === "morning") return "and(local_time.lt.12:00:00)";
      if (slot === "afternoon") return "and(local_time.gte.12:00:00,local_time.lt.18:00:00)";
      return "and(local_time.gte.18:00:00)"; // evening
    });
    query = query.or(ranges.join(","), { referencedTable: "activity_sessions" });
  }

  if (filters.durationMin !== undefined) {
    query = query.gte("duration_minutes", filters.durationMin);
  }

  if (filters.durationMax !== undefined) {
    query = query.lte("duration_minutes", filters.durationMax);
  }

  // Group-size filters run against the session's seat columns.
  //
  // `minPeople` is "how many people are in my group" — the user
  // needs that many seats ACTUALLY AVAILABLE right now, so it
  // compares against `seats_remaining`. Using `max_seats` here was
  // the bug that let a session with 10 total seats but only 2 left
  // match a 6-person search.
  //
  // `maxPeople` is "how intimate / how big a class at most" — it's
  // about the class size, not current availability, so it stays on
  // `max_seats`.
  if (filters.minPeople !== undefined) {
    query = query.gte("activity_sessions.seats_remaining", filters.minPeople);
  }

  if (filters.maxPeople !== undefined) {
    query = query.lte("activity_sessions.max_seats", filters.maxPeople);
  }

  switch (effectiveSort) {
    case "price_asc":
      query = query.order("price_cents", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price_cents", { ascending: false });
      break;
    case "rating":
      // Avg rating is computed in JS (no SQL column); fetch all, sort
      // below. The fetch-order tiebreaker used to be `activities.date`
      // but that column is no longer authoritative — `created_at` keeps
      // the order stable while falling off the legacy columns in 6A.
      query = query.order("created_at", { ascending: false });
      break;
    case "relevance":
      // No DB order — rankMap drives ordering in JS below.
      break;
    case "newest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  const limit = filters.limit || 12;
  const offset = filters.offset || 0;
  const isRatingSort = effectiveSort === "rating";
  const isRelevanceSort = effectiveSort === "relevance" && rankMap !== null;

  if (!isRatingSort && !isRelevanceSort) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Error fetching activities:", error);
    return { data: [], count: 0 };
  }

  let rows = (data as unknown as (ActivityWithInstructor & {
    reviews: { rating: number }[];
  })[]) || [];

  // Compute avg rating for every row + synthesize legacy date/time/
  // max_seats/seats_remaining from the primary session (Phase 6A).
  rows = rows.map((row) => {
    const reviews = row.reviews || [];
    const avg =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;
    const withSynth = applyLegacySynthesisToRow({
      ...row,
      avg_rating: avg,
      review_count: reviews.length,
    });
    return withSynth;
  });

  if (isRelevanceSort) {
    rows = sortByRankAndSlice(rows, rankMap!, offset, limit);
  } else if (isRatingSort) {
    rows.sort(
      (a, b) =>
        (b.avg_rating || 0) - (a.avg_rating || 0) ||
        (b.review_count || 0) - (a.review_count || 0)
    );
    rows = rows.slice(offset, offset + limit);
  }

  return {
    data: rows,
    count: count || 0,
  };
}

export async function fetchActivityById(
  id: string
): Promise<ActivityWithInstructor | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      *,
      instructor_profiles!inner (
        id,
        user_id,
        bio,
        specialties,
        social_links,
        users!inner (name, avatar_url)
      ),
      categories!inner (name, slug, icon),
      activity_sessions (id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time, quorum_state, instructor_confirmed_at)
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  // Synthesize legacy date/time/max_seats/seats_remaining from the
  // primary session (Phase 6A). All sessions are included here —
  // including past/cancelled — so the detail page can show e.g. a
  // sold-out banner backed by real session state.
  return applyLegacySynthesisToRow(
    data as unknown as ActivityWithInstructor
  );
}

/**
 * Picks the "representative" session for a given activity — the
 * next bookable (upcoming, published, has seats) one, or null.
 *
 * During the Phase 1–3 transition window each activity has exactly
 * one session (enforced by the mirror trigger's single-session
 * guard), so this just returns that session. Phase 5 will replace
 * direct callers with an in-page session picker.
 */
export function pickBookableSession(
  sessions: ActivitySessionSummary[] | undefined
): ActivitySessionSummary | null {
  if (!sessions || sessions.length === 0) return null;
  const now = Date.now();
  const bookable = sessions
    .filter(
      (s) =>
        s.status === "published" &&
        new Date(s.starts_at).getTime() > now &&
        s.seats_remaining > 0
    )
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
  return bookable[0] ?? null;
}

export async function fetchActivityReviews(
  activityId: string
): Promise<
  {
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    users: { name: string; avatar_url: string | null };
    review_photos: { id: string; image_url: string }[];
  }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      id, rating, comment, created_at,
      users!inner (name, avatar_url),
      review_photos (id, image_url)
    `
    )
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data as unknown as {
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    users: { name: string; avatar_url: string | null };
    review_photos: { id: string; image_url: string }[];
  }[]) || [];
}

export async function fetchRecommendations(
  activityId: string,
  categoryId: string,
  city: string,
  limit: number = 4
): Promise<ActivityWithInstructor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      *,
      instructor_profiles!inner (
        id,
        user_id,
        users!inner (name, avatar_url)
      ),
      categories!inner (name, slug, icon),
      activity_sessions!inner (
        id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time, quorum_state, instructor_confirmed_at
      )
    `
    )
    .eq("status", "published")
    .eq("activity_sessions.status", "published")
    .eq("category_id", categoryId)
    .neq("id", activityId)
    // Only recommend activities that have at least one upcoming session.
    .gte("activity_sessions.local_date", new Date().toISOString().split("T")[0])
    .order("city", { ascending: city ? true : false })
    .limit(limit);

  if (error) return [];

  // Phase 6A: synthesize the legacy date/time/max_seats/seats_remaining
  // fields on each recommendation so the activity card (which still reads
  // row.date / row.seats_remaining) stays pointed at session-level truth.
  const rows = (data as unknown as ActivityWithInstructor[]) || [];
  return rows.map((row) => applyLegacySynthesisToRow(row));
}

export interface FilterBounds {
  priceMin: number;    // reais (rounded down)
  priceMax: number;    // reais (rounded up)
  durationMin: number; // minutes
  durationMax: number; // minutes
  peopleMin: number;
  peopleMax: number;
}

/**
 * Fetches min/max bounds for the price / duration / people sliders,
 * scoped to the same filter context as the page but *excluding* the
 * bound being computed for (so each slider's own selection doesn't
 * collapse its own range).
 *
 * We issue three lightweight queries — one per dimension — each with
 * the other filters applied. Columns are small (INTs), so the payload
 * stays tiny. Missing inventory yields sensible fallbacks.
 */
export async function fetchFilterBounds(
  ctx: Omit<ActivityFilters, "sort" | "limit" | "offset">
): Promise<FilterBounds> {
  const supabase = await createClient();

  // Single query with all three columns. Each slider's own
  // params (min/maxPrice, duration*, min/maxPeople) are applied
  // upstream by the caller EXCEPT its own — we rely on the caller
  // to pass a `ctx` that omits the slider's own selection so the
  // range doesn't collapse to its current value.
  let query = supabase
    .from("activities")
    .select(
      // Embed sessions so date/time-of-day filters scope to session rows,
      // matching fetchActivities. See comment there for rationale.
      // Phase 6A: `max_seats` is pulled from the session embed, not the
      // parent row — sessions own seat counts.
      "price_cents,duration_minutes,activity_sessions!inner(local_date,local_time,status,max_seats)"
    )
    .eq("status", "published")
    .eq("activity_sessions.status", "published");

  if (ctx.categoryIds && ctx.categoryIds.length > 0) {
    query = query.in("category_id", ctx.categoryIds);
  }
  if (ctx.neighborhoods && ctx.neighborhoods.length > 0) {
    query = query.in("neighborhood", ctx.neighborhoods);
  }
  if (ctx.dateFrom) query = query.gte("activity_sessions.local_date", ctx.dateFrom);
  if (ctx.dateTo) query = query.lte("activity_sessions.local_date", ctx.dateTo);
  if (ctx.timeOfDay && ctx.timeOfDay.length > 0) {
    const ranges = ctx.timeOfDay.map((slot) => {
      if (slot === "morning") return "and(local_time.lt.12:00:00)";
      if (slot === "afternoon") return "and(local_time.gte.12:00:00,local_time.lt.18:00:00)";
      return "and(local_time.gte.18:00:00)";
    });
    query = query.or(ranges.join(","), { referencedTable: "activity_sessions" });
  }

  const { data, error } = await query;
  if (error || !data) {
    return {
      priceMin: 0,
      priceMax: 500,
      durationMin: 30,
      durationMax: 300,
      peopleMin: 1,
      peopleMax: 20,
    };
  }

  type SessionBound = { max_seats: number };
  type Row = {
    price_cents: number;
    duration_minutes: number;
    activity_sessions: SessionBound[];
  };
  const rows = data as Row[];
  const prices = rows.map((r) => r.price_cents);
  const durations = rows.map((r) => r.duration_minutes);
  // Flatten every matching session's max_seats across all activities —
  // a 2-seat and a 20-seat session on the same activity both count
  // toward the group-size slider's range.
  const people = rows.flatMap((r) =>
    (r.activity_sessions ?? []).map((s) => s.max_seats)
  );

  const priceMin = prices.length > 0 ? Math.floor(Math.min(...prices) / 100) : 0;
  const priceMax = prices.length > 0 ? Math.ceil(Math.max(...prices) / 100) : 500;
  // Snap duration bounds to the filter slider's 30-minute step so the
  // max value is always reachable on the native step grid. Without this,
  // an activity with a 75-minute duration yields bounds like [75, 75]
  // or [75, 120] — neither endpoint lands on the 30-min grid from min,
  // and the slider's right thumb visually desyncs from the label.
  const DURATION_STEP_MIN = 30;
  const durationMin =
    durations.length > 0
      ? Math.floor(Math.min(...durations) / DURATION_STEP_MIN) *
        DURATION_STEP_MIN
      : 30;
  const durationMax =
    durations.length > 0
      ? Math.ceil(Math.max(...durations) / DURATION_STEP_MIN) *
        DURATION_STEP_MIN
      : 300;
  // Always anchor the lower bound at 1 — group sizes of 1 are valid filter choices
  // even if no listing's max_seats happens to be 1.
  const peopleMin = 1;
  const peopleMax = people.length > 0 ? Math.max(...people) : 20;

  return { priceMin, priceMax, durationMin, durationMax, peopleMin, peopleMax };
}

export async function fetchNeighborhoods(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select("neighborhood")
    .eq("status", "published");

  if (error || !data) return [];

  const unique = Array.from(
    new Set(data.map((row) => row.neighborhood).filter(Boolean))
  );
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

export async function fetchFeaturedActivities(
  limit: number = 6
): Promise<ActivityWithInstructor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      *,
      instructor_profiles!inner (
        id,
        user_id,
        users!inner (name, avatar_url)
      ),
      categories!inner (name, slug, icon),
      activity_sessions!inner (
        id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time, quorum_state, instructor_confirmed_at
      )
    `
    )
    .eq("status", "published")
    .eq("featured_on_home", true)
    .eq("activity_sessions.status", "published")
    // Only feature activities with an upcoming session that still has seats.
    .gte("activity_sessions.local_date", new Date().toISOString().split("T")[0])
    .gt("activity_sessions.seats_remaining", 0)
    // Phase 6A: we can't `.order("activities.date", ...)` anymore since
    // that column no longer drives what session the user will book
    // against. PostgREST won't sort the parent by an embedded column
    // either, so we overfetch by ~4× and JS-sort by the primary
    // session's starts_at before slicing to `limit`. At 6-24 rows
    // this is trivially cheap and lets the feature use the real
    // "next bookable session" date across multi-session activities.
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 4, 24));

  if (error) return [];

  const rows = (data as unknown as ActivityWithInstructor[]) || [];
  const synthed = rows.map((row) => applyLegacySynthesisToRow(row));
  synthed.sort((a, b) => {
    const sa = pickPrimarySession(a.activity_sessions)?.starts_at ?? "";
    const sb = pickPrimarySession(b.activity_sessions)?.starts_at ?? "";
    return sa.localeCompare(sb);
  });
  return synthed.slice(0, limit);
}
