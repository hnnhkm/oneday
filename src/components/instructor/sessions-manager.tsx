"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  addActivitySessionAction,
  cancelActivitySessionAction,
  deleteActivitySessionAction,
} from "@/lib/actions/sessions";
import type { SessionRow } from "@/lib/queries/instructor";
import { formatDate, formatDurationHours } from "@/lib/utils";

interface Props {
  activityId: string;
  durationMinutes: number;
  sessions: SessionRow[];
}

/**
 * Instructor-side UI for the activity → sessions split. Lists every
 * session attached to the activity and provides inline add / cancel /
 * delete affordances. `durationMinutes` comes from the activity row
 * because the sessions themselves just store `starts_at` / `ends_at`
 * — the instructor doesn't re-pick a duration per session.
 *
 * During Phase 4 (multi-session rollout) the activity detail page
 * still auto-picks the next bookable session via pickBookableSession;
 * Phase 5 replaces that with a user-facing picker.
 */
export function SessionsManager({
  activityId,
  durationMinutes,
  sessions,
}: Props) {
  const t = useTranslations("instructor.sessions");
  const locale = useLocale();
  const router = useRouter();

  const [showAdd, setShowAdd] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [maxSeats, setMaxSeats] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Per-row pending state so only the targeted row shows a spinner
  // when cancel/delete is in flight.
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{
    sessionId: string;
    message: string;
  } | null>(null);

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addActivitySessionAction(activityId, {
        date,
        time,
        max_seats: maxSeats,
      });
      if (!result.ok) {
        setError(reasonToMessage(result.reason) ?? result.error ?? t("errorGeneric"));
        return;
      }
      setDate("");
      setTime("");
      setMaxSeats(10);
      setShowAdd(false);
      router.refresh();
    });
  }

  function onCancel(sessionId: string) {
    // Using window.confirm for now rather than building a full modal —
    // matches the style of the delete-activity confirm in the same
    // dashboard. Upgrade later if product wants a reason field.
    if (!window.confirm(t("cancelConfirm"))) return;
    setRowError(null);
    setBusySessionId(sessionId);
    startTransition(async () => {
      const result = await cancelActivitySessionAction(sessionId);
      setBusySessionId(null);
      if (!result.ok) {
        setRowError({
          sessionId,
          message: reasonToMessage(result.reason) ?? result.error ?? t("errorGeneric"),
        });
        return;
      }
      router.refresh();
    });
  }

  function onDelete(sessionId: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    setRowError(null);
    setBusySessionId(sessionId);
    startTransition(async () => {
      const result = await deleteActivitySessionAction(sessionId);
      setBusySessionId(null);
      if (!result.ok) {
        setRowError({
          sessionId,
          message: reasonToMessage(result.reason) ?? result.error ?? t("errorGeneric"),
        });
        return;
      }
      router.refresh();
    });
  }

  function reasonToMessage(reason?: string): string | null {
    if (!reason) return null;
    // Keys mirror the SessionActionResult.reason union; unknown reasons
    // fall through to the generic fallback.
    const known: Record<string, string> = {
      not_authenticated: "errorAuth",
      not_authorized: "errorAuth",
      activity_not_found: "errorNotFound",
      session_not_found: "errorNotFound",
      has_bookings: "errorHasBookings",
      invalid_date: "errorInvalidDate",
      invalid_time: "errorInvalidTime",
      invalid_seats: "errorInvalidSeats",
      in_the_past: "errorPast",
      conflict_with_existing_session: "errorConflict",
    };
    const key = known[reason];
    if (!key) return null;
    return t(key);
  }

  return (
    <section className="rounded-lg bg-white shadow-card p-5 mb-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-charcoal">{t("title")}</h2>
          <p className="text-xs text-charcoal-lighter mt-0.5">{t("subtitle")}</p>
        </div>
        {!showAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            {t("add")}
          </Button>
        )}
      </header>

      {showAdd && (
        <form
          onSubmit={onAdd}
          className="mb-4 rounded-md border border-charcoal-lighter/20 bg-background-muted p-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="new-session-date"
                className="block text-xs font-medium text-charcoal mb-1"
              >
                {t("fieldDate")}
              </label>
              <input
                id="new-session-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded border border-charcoal-lighter/30 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="new-session-time"
                className="block text-xs font-medium text-charcoal mb-1"
              >
                {t("fieldTime")}
              </label>
              <input
                id="new-session-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full rounded border border-charcoal-lighter/30 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="new-session-seats"
                className="block text-xs font-medium text-charcoal mb-1"
              >
                {t("fieldMaxSeats")}
              </label>
              <input
                id="new-session-seats"
                type="number"
                min={1}
                max={1000}
                value={maxSeats}
                onChange={(e) => setMaxSeats(Math.max(1, Number(e.target.value) || 1))}
                required
                className="w-full rounded border border-charcoal-lighter/30 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <p className="mt-2 text-xs text-charcoal-lighter">
            {t("durationHint", {
              duration: formatDurationHours(durationMinutes),
            })}
          </p>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAdd(false);
                setError(null);
              }}
              disabled={isPending}
            >
              {t("cancelAdd")}
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      )}

      {sessions.length === 0 ? (
        <p className="text-sm text-charcoal-lighter text-center py-6">
          {t("empty")}
        </p>
      ) : (
        <ul className="divide-y divide-charcoal-lighter/10">
          {sessions.map((s) => {
            const startsAt = new Date(s.starts_at);
            const isPast = startsAt.getTime() < Date.now();
            const isCancelled = s.status === "cancelled";
            const isBusy = busySessionId === s.id;
            const timeLabel = startsAt.toLocaleTimeString(
              localeToIntl(locale),
              {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              }
            );
            const dateLabel = formatDate(s.starts_at.slice(0, 10), locale);
            const statusLabel = isCancelled
              ? t("statusCancelled")
              : isPast
              ? t("statusPast")
              : s.status === "draft"
              ? t("statusDraft")
              : t("statusPublished");

            return (
              <li key={s.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-charcoal">
                        {dateLabel} · {timeLabel}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${statusPillClass(
                          s.status,
                          isPast
                        )}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="text-xs text-charcoal-lighter mt-1">
                      {t("seatsLine", {
                        booked: s.booked_seats,
                        total: s.max_seats,
                      })}
                      {" · "}
                      {formatDurationHours(durationMinutes)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isPast && !isCancelled && s.booked_seats > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCancel(s.id)}
                        disabled={isBusy || isPending}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {isBusy ? t("working") : t("actionCancel")}
                      </Button>
                    )}
                    {!isPast && !isCancelled && s.booked_seats === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(s.id)}
                        disabled={isBusy || isPending}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {isBusy ? t("working") : t("actionDelete")}
                      </Button>
                    )}
                  </div>
                </div>
                {rowError?.sessionId === s.id && (
                  <p className="mt-2 text-xs text-red-600">{rowError.message}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function localeToIntl(locale: string): string {
  return locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US";
}

function statusPillClass(status: string, isPast: boolean): string {
  if (status === "cancelled") {
    return "bg-red-50 text-red-600";
  }
  if (isPast) {
    return "bg-charcoal-lighter/10 text-charcoal-lighter";
  }
  if (status === "draft") {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-primary-50 text-primary-600";
}
