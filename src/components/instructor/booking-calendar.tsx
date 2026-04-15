import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import {
  getCalendarDays,
  groupBookingsByDate,
  formatMonthYear,
} from "@/lib/booking-calendar";
import { cn } from "@/lib/utils";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

interface BookingCalendarProps {
  bookings: Array<{
    activityDate: string;
    status: "confirmed" | "cancelled" | "completed";
  }>;
  year: number;
  month: number; // 0-indexed
  locale: string;
  selectedDate?: string;
}

/**
 * Month grid showing booking counts per day. Server component.
 *
 * Each day with bookings renders as a link that sets `?date=YYYY-MM-DD`
 * to filter the table below. Prev/next month arrows navigate via
 * `?month=YYYY-MM` params. Days outside the displayed month are dimmed.
 */
export async function BookingCalendar({
  bookings,
  year,
  month,
  locale,
  selectedDate,
}: BookingCalendarProps) {
  const t = await getTranslations("instructor.calendar");
  const days = getCalendarDays(year, month);
  const counts = groupBookingsByDate(bookings);
  const title = formatMonthYear(year, month, locale);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const monthParam = (y: number, m: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}`;

  return (
    <div className="rounded-lg bg-white shadow-card p-4 mb-6">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/instructor/bookings?month=${monthParam(prevYear, prevMonth)}` as "/instructor/bookings"}
          className="px-3 py-1 rounded text-charcoal hover:bg-background-muted transition-colors"
          aria-label={t("prevMonth")}
        >
          ‹
        </Link>
        <h2 className="text-sm font-semibold text-charcoal capitalize">
          {title}
        </h2>
        <Link
          href={`/instructor/bookings?month=${monthParam(nextYear, nextMonth)}` as "/instructor/bookings"}
          className="px-3 py-1 rounded text-charcoal hover:bg-background-muted transition-colors"
          aria-label={t("nextMonth")}
        >
          ›
        </Link>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-charcoal-lighter mb-1">
        {WEEKDAY_KEYS.map((key) => (
          <div key={key} className="py-1">
            {t(key)}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((d) => {
          const count = counts.get(d.date) || 0;
          const isSelected = d.date === selectedDate;

          const cell = (
            <div
              className={cn(
                "relative aspect-square flex flex-col items-center justify-center rounded text-sm transition-colors",
                !d.inMonth && "text-charcoal-lighter/30",
                d.inMonth && "text-charcoal",
                d.isToday && "ring-1 ring-primary-400",
                isSelected && "bg-primary-50",
                count > 0 && d.inMonth && "font-medium"
              )}
            >
              <span>{d.day}</span>
              {count > 0 && d.inMonth && (
                <span className="absolute bottom-0.5 w-5 h-4 flex items-center justify-center rounded-full bg-primary-400 text-white text-[10px] font-bold">
                  {count}
                </span>
              )}
            </div>
          );

          if (count > 0 && d.inMonth) {
            return (
              <Link
                key={d.date}
                href={`/instructor/bookings?month=${monthParam(year, month)}&date=${d.date}` as "/instructor/bookings"}
                className="hover:bg-background-muted rounded"
              >
                {cell}
              </Link>
            );
          }

          return <div key={d.date}>{cell}</div>;
        })}
      </div>
    </div>
  );
}
