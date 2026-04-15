"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "./booking-flow-context";
import { getQuorumStatus } from "@/lib/quorum";
import type { ActivitySessionSummary } from "@/lib/queries/activities";

/**
 * Two-level session selector: a horizontally-scrollable date strip
 * on top, and a horizontally-scrollable time-slot grid for the
 * currently-selected date below. Replaces the earlier `<select>`
 * dropdown in `BookingForm` and the standalone "Outros horários"
 * block — this is now the single session-selection surface on the
 * activity detail page.
 *
 * Why two levels instead of a flat list: recurring activities can
 * have the same day host multiple time slots (morning + evening
 * cooking class). Flattening every (date, time) combination into a
 * dropdown scales poorly and buries the schedule shape. The two
 * levels match how a user actually thinks: "which day, then which
 * time on that day".
 *
 * Data rules:
 *   - Only `published` sessions appear.
 *   - Dates where every session is already in the past are omitted
 *     from the strip — they're not actionable and just clutter.
 *   - Within a date, ALL its sessions show (past/sold-out included
 *     as disabled cards) so the user sees the full shape of that
 *     day's schedule, not a misleading subset.
 */
interface DateGroup {
  dateISO: string; // YYYY-MM-DD in São Paulo wall-clock
  sessions: ActivitySessionSummary[];
}

export function SessionPicker() {
  const t = useTranslations("activities");
  const locale = useLocale() as "pt" | "en" | "es";
  const { sessions, selectedSession, setSelectedSessionId, minParticipants } = useBookingFlow();

  const groups = useMemo<DateGroup[]>(() => {
    const now = Date.now();
    const byDate = new Map<string, ActivitySessionSummary[]>();
    for (const s of sessions) {
      if (s.status !== "published") continue;
      const date = toSpDate(s.starts_at);
      const arr = byDate.get(date);
      if (arr) arr.push(s);
      else byDate.set(date, [s]);
    }
    const result: DateGroup[] = [];
    // Use Array.from instead of `for (... of byDate)` — our tsconfig
    // target doesn't enable downlevelIteration so direct Map iteration
    // fails typecheck.
    Array.from(byDate.entries()).forEach(([date, daySessions]) => {
      const hasFuture = daySessions.some(
        (s: ActivitySessionSummary) => new Date(s.starts_at).getTime() > now
      );
      if (!hasFuture) return;
      daySessions.sort(
        (a: ActivitySessionSummary, b: ActivitySessionSummary) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );
      result.push({ dateISO: date, sessions: daySessions });
    });
    result.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    return result;
  }, [sessions]);

  // Derive the currently-selected date from the selected session's
  // start time, so clicking a time slot from one date and then the
  // date-strip both flow through a single source of truth. Falls
  // back to the first group's date on initial mount before the
  // provider has defaulted `selectedSessionId`.
  const selectedDate = selectedSession
    ? toSpDate(selectedSession.starts_at)
    : (groups[0]?.dateISO ?? null);
  const selectedGroup =
    groups.find((g) => g.dateISO === selectedDate) ?? null;

  if (groups.length === 0) return null;

  /**
   * Tapping a date auto-selects the first AVAILABLE slot on that
   * date. This means a single tap is enough for days that only
   * have one bookable slot (most of our current data), and the
   * user immediately sees the time-slot card switch to the
   * outlined selected state — confirming their action. If no slot
   * is available (all past/sold-out) we still pick the first slot
   * so the grid has a selection to render; the submit button stays
   * disabled via the form's own guards.
   */
  function handleDateClick(dateISO: string) {
    const group = groups.find((g) => g.dateISO === dateISO);
    if (!group) return;
    const now = Date.now();
    const firstAvailable = group.sessions.find(
      (s) => new Date(s.starts_at).getTime() > now && s.seats_remaining > 0
    );
    const pick = firstAvailable ?? group.sessions[0];
    if (pick) setSelectedSessionId(pick.id);
  }

  return (
    <div className="bg-white rounded-lg shadow-card p-5">
      <h2 className="text-lg font-semibold text-charcoal">
        {t("chooseDateTime")}
      </h2>
      {selectedGroup && (
        <p className="text-sm text-charcoal-lighter mt-0.5 mb-4">
          {formatMonthLabel(selectedGroup.dateISO, locale)}
        </p>
      )}

      <DateStrip
        groups={groups}
        selectedDateISO={selectedDate}
        onSelect={handleDateClick}
        locale={locale}
      />

      {selectedGroup && (
        <div className="mt-4 border-t border-charcoal-lighter/10 pt-4">
          <TimeSlotGrid
            sessions={selectedGroup.sessions}
            selectedId={selectedSession?.id ?? null}
            onSelect={setSelectedSessionId}
            locale={locale}
            minParticipants={minParticipants}
          />
        </div>
      )}
    </div>
  );
}

function DateStrip({
  groups,
  selectedDateISO,
  onSelect,
  locale,
}: {
  groups: DateGroup[];
  selectedDateISO: string | null;
  onSelect: (dateISO: string) => void;
  locale: "pt" | "en" | "es";
}) {
  const t = useTranslations("activities");
  const now = Date.now();
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
      {groups.map((g) => {
        const isSelected = g.dateISO === selectedDateISO;
        const hasAvailable = g.sessions.some(
          (s) =>
            new Date(s.starts_at).getTime() > now && s.seats_remaining > 0
        );
        const { weekday, day } = formatDateParts(g.dateISO, locale);
        return (
          <button
            key={g.dateISO}
            type="button"
            onClick={() => onSelect(g.dateISO)}
            className="flex flex-col items-center shrink-0 w-14 pt-1"
            aria-pressed={isSelected}
          >
            <span
              className={cn(
                "text-xs",
                isSelected
                  ? "text-charcoal font-medium"
                  : "text-charcoal-lighter"
              )}
            >
              {weekday}
            </span>
            <span
              className={cn(
                "mt-1 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                isSelected
                  ? "bg-primary-400 text-white"
                  : hasAvailable
                    ? "text-charcoal hover:bg-background-muted"
                    : "text-charcoal-lighter/60"
              )}
            >
              {day}
            </span>
            {!hasAvailable && !isSelected && (
              <span className="mt-1 text-[10px] text-charcoal-lighter/80">
                {t("soldOut")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TimeSlotGrid({
  sessions,
  selectedId,
  onSelect,
  locale,
  minParticipants,
}: {
  sessions: ActivitySessionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  locale: "pt" | "en" | "es";
  minParticipants: number;
}) {
  const t = useTranslations("activities");
  const now = Date.now();
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {sessions.map((s) => {
        const isPast = new Date(s.starts_at).getTime() <= now;
        const isSoldOut = s.seats_remaining === 0;
        const isDisabled = isPast || isSoldOut;
        const isSelected = s.id === selectedId;
        const scarce = !isDisabled && s.seats_remaining < 5;
        const booked = s.max_seats - s.seats_remaining;
        const quorum = getQuorumStatus(minParticipants, booked, s.quorum_state);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            disabled={isDisabled}
            className={cn(
              "shrink-0 w-32 rounded-xl border px-3 py-2.5 text-left transition-colors",
              isDisabled
                ? "border-charcoal-lighter/10 bg-background-muted cursor-not-allowed"
                : isSelected
                  ? "border-primary-400 bg-primary-50"
                  : "border-charcoal-lighter/20 hover:border-charcoal-lighter/40 bg-white"
            )}
            aria-pressed={isSelected}
          >
            {/* Status line — fixed height so the cards stay same-size
                across states (past/sold-out/available), otherwise the
                grid's vertical rhythm breaks. */}
            <div className="text-[11px] font-medium mb-0.5 h-4">
              {isPast ? (
                <span className="text-charcoal-lighter">{t("past")}</span>
              ) : isSoldOut ? (
                <span className="text-charcoal-lighter">{t("soldOut")}</span>
              ) : quorum.kind === "confirmed" ? (
                <span className="text-primary-500">
                  <span aria-hidden="true">✓</span> {t("quorumConfirmed")}
                </span>
              ) : quorum.kind === "at_risk" ? (
                <span className="text-accent-600">{t("quorumAtRisk")}</span>
              ) : quorum.kind === "close" ? (
                <span className="text-primary-500">
                  {t("quorumClose", { needed: quorum.needed })}
                </span>
              ) : scarce ? (
                <span className="text-accent-600">
                  {formatSeats(s.seats_remaining, locale)}
                </span>
              ) : (
                <span className="text-primary-500">{t("available")}</span>
              )}
            </div>
            <div
              className={cn(
                "text-sm font-semibold",
                isDisabled ? "text-charcoal-lighter" : "text-charcoal"
              )}
            >
              {formatTimeRange(s.starts_at, s.ends_at, locale)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---- formatters ----

/**
 * Converts a TIMESTAMPTZ to a São Paulo wall-clock YYYY-MM-DD. We
 * don't trust the incoming `local_date` generated column here
 * because `ActivitySessionSummary` doesn't include it, and adding
 * it to the type just for this component is more friction than the
 * 10-line formatter. Matches `sessionStartToLocalDate` in
 * `session-synthesis.ts` — SP has been a stable UTC−03:00 since 2019
 * so no DST edge cases.
 */
function toSpDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function formatDateParts(
  dateISO: string,
  locale: "pt" | "en" | "es"
): { weekday: string; day: number } {
  const localeMap = { pt: "pt-BR", en: "en-US", es: "es-ES" } as const;
  // Noon + explicit SP offset keeps the wall-clock date stable
  // regardless of the browser's timezone — same trick used in the
  // activity card's date formatter.
  const d = new Date(`${dateISO}T12:00:00-03:00`);
  const weekday = d.toLocaleDateString(localeMap[locale], {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  });
  const day = parseInt(dateISO.slice(-2), 10);
  return {
    // pt-BR returns "ter." for Tuesday — strip the trailing dot for
    // a cleaner strip; en/es don't include the dot so the replace is
    // a no-op there.
    weekday: weekday.replace(/\.$/, ""),
    day,
  };
}

function formatMonthLabel(
  dateISO: string,
  locale: "pt" | "en" | "es"
): string {
  const localeMap = { pt: "pt-BR", en: "en-US", es: "es-ES" } as const;
  const d = new Date(`${dateISO}T12:00:00-03:00`);
  const label = d.toLocaleDateString(localeMap[locale], {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatTimeRange(
  startsAt: string,
  endsAt: string,
  locale: "pt" | "en" | "es"
): string {
  const localeMap = { pt: "pt-BR", en: "en-US", es: "es-ES" } as const;
  const opts = {
    hour: "2-digit" as const,
    minute: "2-digit" as const,
    timeZone: "America/Sao_Paulo",
    hour12: false,
  };
  const start = new Date(startsAt).toLocaleTimeString(localeMap[locale], opts);
  const end = new Date(endsAt).toLocaleTimeString(localeMap[locale], opts);
  return `${start} – ${end}`;
}

function formatSeats(count: number, locale: "pt" | "en" | "es"): string {
  if (locale === "pt") return `${count} ${count === 1 ? "vaga" : "vagas"}`;
  if (locale === "es") return `${count} ${count === 1 ? "plaza" : "plazas"}`;
  return `${count} ${count === 1 ? "seat" : "seats"}`;
}
