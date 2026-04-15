/**
 * Synthesizes the legacy `activity.date | time | max_seats |
 * seats_remaining` fields on an activity-shaped row from the activity's
 * sessions.
 *
 * Phase 6A of the activity-sessions split migrates every reader off
 * the legacy columns while keeping the columns themselves intact as
 * a safety net. We do that by:
 *
 *   1. Fetching `activity_sessions(local_date, local_time, starts_at,
 *      max_seats, seats_remaining, status)` via the PostgREST embed
 *      instead of selecting the legacy columns from the parent row.
 *   2. Overwriting the legacy field names on each row with values
 *      derived from the "primary" session — the next upcoming
 *      published session with seats, falling back to the earliest
 *      session if none are upcoming. Downstream readers keep
 *      accessing `activity.date`, `activity.time`, etc. without
 *      knowing the source moved.
 *
 * Phase 6B drops the legacy columns + mirror triggers; at that point
 * this helper is the only source of those field names in returned
 * rows. No reader change is needed for 6B.
 */
export interface SessionLike {
  id?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  local_date?: string | null;
  local_time?: string | null;
  max_seats: number;
  seats_remaining: number;
  status: "draft" | "published" | "cancelled" | "completed";
}

/**
 * Picks the "primary" session for a given activity row:
 *   (1) next upcoming published session that still has seats, or
 *   (2) the earliest published session regardless of seats, or
 *   (3) the earliest session of any status, or
 *   (4) null if the activity has no sessions at all.
 *
 * Tiers (2) and (3) keep past/sold-out activities renderable so the
 * "past bookings" tab and the instructor's draft list still show
 * sensible date/time info.
 */
export function pickPrimarySession<T extends SessionLike>(
  sessions: T[] | undefined | null,
  now: number = Date.now()
): T | null {
  if (!sessions || sessions.length === 0) return null;

  const byStartAsc = [...sessions].sort((a, b) =>
    compareSessionStart(a, b)
  );

  const upcomingWithSeats = byStartAsc.find(
    (s) =>
      s.status === "published" &&
      sessionStartMs(s) > now &&
      s.seats_remaining > 0
  );
  if (upcomingWithSeats) return upcomingWithSeats;

  const earliestPublished = byStartAsc.find((s) => s.status === "published");
  if (earliestPublished) return earliestPublished;

  return byStartAsc[0] ?? null;
}

/**
 * The shape the legacy columns used: DATE (YYYY-MM-DD) in São Paulo
 * wall-clock, TIME (HH:MM:SS) in the same zone, INT max_seats, INT
 * seats_remaining. Synthesizing this shape keeps downstream readers
 * (UI components, date formatters, the bookings-tab categorizer, the
 * no-show guard, etc.) working without edits.
 */
export interface LegacyActivityFields {
  date: string;
  time: string;
  max_seats: number;
  seats_remaining: number;
}

/**
 * Returns the legacy field values synthesized from a primary session
 * — or null when the activity has no sessions at all. Callers that
 * can't tolerate a nullable result can fall back to zeros / today's
 * date, but as of Phase 6A every activity has ≥1 session (enforced
 * by the mirror trigger on activity INSERT).
 */
export function synthesizeLegacyFields(
  primary: SessionLike | null
): LegacyActivityFields | null {
  if (!primary) return null;
  const date = primary.local_date || sessionStartToLocalDate(primary);
  const time = primary.local_time || sessionStartToLocalTime(primary);
  return {
    date,
    time,
    max_seats: primary.max_seats,
    seats_remaining: primary.seats_remaining,
  };
}

/**
 * Convenience: given an activity-ish row that already embeds its
 * sessions under `activity_sessions`, attach `date`, `time`,
 * `max_seats`, `seats_remaining` in-place. Returns the same reference
 * so the call is chainable inside `.map(...)`.
 *
 * Generic over the row shape — the helper only requires
 * `activity_sessions`. If the embed is missing the helper is a no-op,
 * which is what we want during the 6A/6B transition: old callers that
 * haven't been migrated yet still see the real `activities.*` columns
 * from the `*` select.
 */
export function applyLegacySynthesisToRow<
  T extends { activity_sessions?: SessionLike[] | null }
>(row: T, now: number = Date.now()): T & Partial<LegacyActivityFields> {
  const primary = pickPrimarySession(row.activity_sessions, now);
  if (!primary) return row;
  const synth = synthesizeLegacyFields(primary);
  if (!synth) return row;
  return Object.assign(row, synth);
}

// ---- helpers ----

function sessionStartMs(s: SessionLike): number {
  return s.starts_at ? new Date(s.starts_at).getTime() : Number.POSITIVE_INFINITY;
}

function compareSessionStart(a: SessionLike, b: SessionLike): number {
  return sessionStartMs(a) - sessionStartMs(b);
}

/**
 * Fallback path for old rows where `local_date`/`local_time` aren't
 * in the embed. Derives a São Paulo wall-clock date from `starts_at`
 * via `Intl.DateTimeFormat` with the fixed SP zone. Agrees with the
 * generated column's output for all post-2019 timestamps (SP is a
 * stable UTC−03:00 with no DST anymore).
 */
function sessionStartToLocalDate(s: SessionLike): string {
  if (!s.starts_at) return "";
  const d = new Date(s.starts_at);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

/**
 * Build a TIMESTAMPTZ ISO string from a São Paulo wall-clock date+time
 * pair. SP hasn't observed DST since 2019, so `-03:00` is a stable
 * offset year-round. Callers on the *write* side of the sessions split
 * (the instructor-side create/duplicate flows, plus the sessions
 * manager panel) pass `(YYYY-MM-DD, HH:MM)` and get back a string that
 * Postgres can parse directly into TIMESTAMPTZ via an INSERT. Kept
 * here so the synthesis module owns both ends of the "wall-clock ↔
 * TIMESTAMPTZ" conversion — readers derive `local_date/local_time`
 * from `starts_at`, writers go the other direction.
 */
export function toSpTimestamptz(date: string, time: string): string {
  const hhmm = time.length === 5 ? `${time}:00` : time;
  return `${date}T${hhmm}-03:00`;
}

function sessionStartToLocalTime(s: SessionLike): string {
  if (!s.starts_at) return "00:00:00";
  const d = new Date(s.starts_at);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const ss = parts.find((p) => p.type === "second")?.value ?? "00";
  return `${h}:${mm}:${ss}`;
}
