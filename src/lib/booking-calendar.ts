/**
 * Pure helpers for the instructor booking calendar view.
 * No server-only imports — unit-testable and client-safe.
 */

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  /** Day of month (1–31) */
  day: number;
  /** True if this day belongs to the displayed month */
  inMonth: boolean;
  /** True if this is today */
  isToday: boolean;
}

/**
 * Count published activities per date. Returns a Map from
 * YYYY-MM-DD → activity count. Used by the public-facing
 * calendar view on /activities.
 */
export function groupActivitiesByDate(
  activities: Array<{ date: string }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of activities) {
    map.set(a.date, (map.get(a.date) || 0) + 1);
  }
  return map;
}

/**
 * Count non-cancelled bookings per activity date. Returns a Map
 * from YYYY-MM-DD → booking count. Cancelled bookings are excluded
 * so the calendar shows "how many bookings are live on this day".
 */
export function groupBookingsByDate(
  bookings: Array<{
    activityDate: string;
    status: "confirmed" | "cancelled" | "completed";
  }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    map.set(b.activityDate, (map.get(b.activityDate) || 0) + 1);
  }
  return map;
}

/**
 * Generate the grid of days for a month calendar. Pads the start
 * to Monday and the end to Sunday so the grid always has complete
 * weeks (35 or 42 cells). Month is 0-indexed (0 = January).
 */
export function getCalendarDays(year: number, month: number): CalendarDay[] {
  const todayStr = new Date().toISOString().slice(0, 10);

  // First day of the month
  const first = new Date(year, month, 1);
  // Day of week: JS Sunday=0, but we want Monday=0
  const startDow = (first.getDay() + 6) % 7; // Mon=0, Tue=1, ..., Sun=6

  // Last day of the month
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();

  // Total cells: pad start to Monday, pad end to Sunday
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const days: CalendarDay[] = [];

  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startDow;
    const d = new Date(year, month, 1 + dayOffset);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      date: dateStr,
      day: d.getDate(),
      inMonth: dayOffset >= 0 && dayOffset < daysInMonth,
      isToday: dateStr === todayStr,
    });
  }

  return days;
}

/**
 * Format a month/year for display. Returns e.g. "Abril 2026" for
 * locale "pt" or "April 2026" for "en".
 */
export function formatMonthYear(
  year: number,
  month: number,
  locale: string
): string {
  const localeMap: Record<string, string> = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
  };
  const d = new Date(year, month, 1);
  return d.toLocaleDateString(localeMap[locale] || "pt-BR", {
    month: "long",
    year: "numeric",
  });
}
