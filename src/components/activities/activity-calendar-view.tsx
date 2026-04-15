"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  getCalendarDays,
  groupActivitiesByDate,
  formatMonthYear,
} from "@/lib/booking-calendar";
import { cn } from "@/lib/utils";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

interface ActivityCalendarViewProps {
  activities: Array<{ date: string }>;
  locale: string;
  year: number;
  month: number; // 0-indexed
  selectedDate?: string;
}

/**
 * Month grid showing activity counts per day on the public
 * /activities browse page. Client component so it can read URL
 * params and build links that preserve existing filters.
 *
 * Clicking a day with activities sets ?dateFrom=X&dateTo=X to
 * filter the list below. Prev/next arrows navigate months.
 */
export function ActivityCalendarView({
  activities,
  locale,
  year,
  month,
  selectedDate,
}: ActivityCalendarViewProps) {
  const t = useTranslations("activities");
  const tCal = useTranslations("instructor.calendar");
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const days = useMemo(() => getCalendarDays(year, month), [year, month]);
  const counts = useMemo(() => groupActivitiesByDate(activities), [activities]);
  const title = formatMonthYear(year, month, locale);

  function buildMonthHref(y: number, m: number): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "calendar");
    params.set("calMonth", `${y}-${String(m + 1).padStart(2, "0")}`);
    params.delete("dateFrom");
    params.delete("dateTo");
    params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  function buildDateHref(date: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "calendar");
    params.set("calMonth", `${year}-${String(month + 1).padStart(2, "0")}`);
    params.set("dateFrom", date);
    params.set("dateTo", date);
    params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  function buildClearHref(): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "calendar");
    params.set("calMonth", `${year}-${String(month + 1).padStart(2, "0")}`);
    params.delete("dateFrom");
    params.delete("dateTo");
    return `${pathname}?${params.toString()}`;
  }

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  return (
    <div>
      <div className="rounded-lg bg-white shadow-card p-4 mb-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={buildMonthHref(prevYear, prevMonth) as "/activities"}
            className="px-3 py-1 rounded text-charcoal hover:bg-background-muted transition-colors"
          >
            ‹
          </Link>
          <h2 className="text-sm font-semibold text-charcoal capitalize">
            {title}
          </h2>
          <Link
            href={buildMonthHref(nextYear, nextMonth) as "/activities"}
            className="px-3 py-1 rounded text-charcoal hover:bg-background-muted transition-colors"
          >
            ›
          </Link>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-charcoal-lighter mb-1">
          {WEEKDAY_KEYS.map((key) => (
            <div key={key} className="py-1">
              {tCal(key)}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 border-t border-l border-charcoal-lighter/10">
          {days.map((d) => {
            const count = counts.get(d.date) || 0;
            const isSelected = d.date === selectedDate;

            const cell = (
              <div
                className={cn(
                  "relative aspect-square flex flex-col items-start justify-start p-1 sm:p-1.5 text-sm transition-colors border-r border-b border-charcoal-lighter/10",
                  !d.inMonth && "text-charcoal-lighter/30 bg-background-muted/30",
                  d.inMonth && "text-charcoal",
                  d.isToday && "ring-1 ring-inset ring-primary-400",
                  isSelected && "bg-primary-50",
                  count > 0 && d.inMonth && "font-medium"
                )}
              >
                <span className="self-end text-xs">{d.day}</span>
                {count > 0 && d.inMonth && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-5 h-4 flex items-center justify-center rounded-full bg-primary-400 text-white text-[10px] font-bold">
                    {count}
                  </span>
                )}
              </div>
            );

            if (count > 0 && d.inMonth) {
              return (
                <Link
                  key={d.date}
                  href={buildDateHref(d.date) as "/activities"}
                  className="hover:bg-background-muted"
                >
                  {cell}
                </Link>
              );
            }

            return <div key={d.date}>{cell}</div>;
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-charcoal-lighter">
            {t("filteringByDate", { date: selectedDate })}
          </span>
          <Link
            href={buildClearHref() as "/activities"}
            className="text-primary-400 hover:underline"
          >
            {t("clearDateFilter")}
          </Link>
        </div>
      )}
    </div>
  );
}
