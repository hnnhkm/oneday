"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { QuickDatePicks } from "./quick-date-picks";

interface DatePanelProps {
  dateFrom: string;
  dateTo: string;
  /**
   * `anyDate` is true when the user explicitly picks "Qualquer data"
   * (both `dateFrom` and `dateTo` are empty, but the selection is
   * intentional — the bar should render "Qualquer data" instead of
   * the placeholder). Undefined or false means "no explicit choice".
   * The parent is responsible for persisting the flag alongside the
   * date range (e.g. on the URL) so a refresh still reads correctly.
   */
  onChange: (dateFrom: string, dateTo: string, anyDate?: boolean) => void;
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function DatePanel({ dateFrom, dateTo, onChange }: DatePanelProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en", { month: "long", year: "numeric" });

  // When start is picked but end isn't, hovering shows a preview range
  const isPickingEnd = !!dateFrom && !dateTo;
  const previewEnd = isPickingEnd && hoveredDay ? toDateStr(hoveredDay) : null;

  // Effective range: committed range or preview range
  const rangeStart = dateFrom || "";
  const rangeEnd = dateTo || previewEnd || "";
  // Ensure start <= end for display
  const effectiveStart = rangeStart && rangeEnd && rangeEnd < rangeStart ? rangeEnd : rangeStart;
  const effectiveEnd = rangeStart && rangeEnd && rangeEnd < rangeStart ? rangeStart : rangeEnd;
  const hasRange = !!effectiveStart && !!effectiveEnd && effectiveStart !== effectiveEnd;

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    const dateStr = toDateStr(day);
    if (!dateFrom || (dateFrom && dateTo)) {
      onChange(dateStr, "");
    } else {
      if (dateStr < dateFrom) {
        onChange(dateStr, dateFrom);
      } else {
        onChange(dateFrom, dateStr);
      }
    }
    setHoveredDay(null);
  }

  function toDateStr(day: number): string {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function isInRange(day: number): boolean {
    if (!hasRange) return false;
    const dateStr = toDateStr(day);
    return dateStr > effectiveStart && dateStr < effectiveEnd;
  }

  function isStart(day: number): boolean {
    return toDateStr(day) === effectiveStart;
  }

  function isEnd(day: number): boolean {
    return hasRange && toDateStr(day) === effectiveEnd;
  }

  function isSelected(day: number): boolean {
    return isStart(day) || isEnd(day);
  }

  function isPast(day: number): boolean {
    const date = new Date(viewYear, viewMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  const isPreview = !dateTo && !!previewEnd;

  return (
    <div className="w-full">
      <QuickDatePicks
        selected={dateFrom}
        onSelect={(from, to) =>
          // The "Qualquer data" pick hands back two empty strings.
          // Surface that to the parent as an explicit `anyDate` so
          // the search bar can display "Qualquer data" rather than
          // falling back to the "Selecionar datas" placeholder.
          onChange(from, to, from === "" && to === "")
        }
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
            <div key={`empty-${i}`} className="h-8" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const past = isPast(day);
            const selected = isSelected(day);
            const inRange = isInRange(day);
            const start = isStart(day);
            const end = isEnd(day);
            return (
              <div
                key={day}
                onMouseEnter={() => { if (isPickingEnd && !past) setHoveredDay(day); }}
                onMouseLeave={() => { if (isPickingEnd) setHoveredDay(null); }}
                className={cn(
                  "relative flex items-center justify-center",
                  hasRange && inRange && "bg-background-muted",
                  hasRange && start && "bg-gradient-to-r from-transparent to-background-muted rounded-l-full",
                  hasRange && end && "bg-gradient-to-l from-transparent to-background-muted rounded-r-full"
                )}
              >
                <button
                  type="button"
                  disabled={past}
                  onClick={() => selectDay(day)}
                  className={cn(
                    "relative z-10 w-8 h-8 text-sm rounded-full transition-colors flex items-center justify-center",
                    past && "text-charcoal-lighter/40 cursor-not-allowed",
                    !past && !selected && !inRange && "text-charcoal hover:bg-background-muted",
                    inRange && !selected && "text-charcoal",
                    start && hasRange && "bg-charcoal text-white font-semibold",
                    end && !isPreview && "bg-charcoal text-white font-semibold",
                    end && isPreview && "ring-2 ring-charcoal font-semibold text-charcoal",
                    selected && !hasRange && "ring-2 ring-charcoal font-semibold text-charcoal"
                  )}
                >
                  {day}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
