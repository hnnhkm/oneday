import {
  groupBookingsByDate,
  getCalendarDays,
  type CalendarDay,
} from "@/lib/booking-calendar";

describe("groupBookingsByDate", () => {
  it("returns an empty map for no bookings", () => {
    expect(groupBookingsByDate([])).toEqual(new Map());
  });

  it("groups bookings by activity date", () => {
    const bookings = [
      { activityDate: "2026-04-15", seats: 2, status: "confirmed" as const },
      { activityDate: "2026-04-15", seats: 1, status: "confirmed" as const },
      { activityDate: "2026-04-20", seats: 3, status: "confirmed" as const },
    ];
    const map = groupBookingsByDate(bookings);
    expect(map.get("2026-04-15")).toBe(2);
    expect(map.get("2026-04-20")).toBe(1);
    expect(map.size).toBe(2);
  });

  it("excludes cancelled bookings", () => {
    const bookings = [
      { activityDate: "2026-04-15", seats: 2, status: "cancelled" as const },
      { activityDate: "2026-04-15", seats: 1, status: "confirmed" as const },
    ];
    const map = groupBookingsByDate(bookings);
    expect(map.get("2026-04-15")).toBe(1);
  });
});

describe("getCalendarDays", () => {
  it("returns 35 or 42 days covering the month with padding", () => {
    // April 2026 starts on Wednesday (day 3, 0=Mon in ISO)
    const days = getCalendarDays(2026, 3); // month is 0-indexed: 3 = April
    // Should start on Monday March 30 and end on a Sunday
    expect(days.length % 7).toBe(0);
    expect(days.length).toBeGreaterThanOrEqual(28);
    expect(days.length).toBeLessThanOrEqual(42);
    // First day should be a Monday
    const firstDate = new Date(days[0].date + "T00:00:00");
    expect(firstDate.getDay()).toBe(1); // Monday
  });

  it("marks days outside the month as not inMonth", () => {
    const days = getCalendarDays(2026, 3); // April 2026
    const april1 = days.find((d) => d.date === "2026-04-01");
    const march31 = days.find((d) => d.date === "2026-03-31");
    expect(april1?.inMonth).toBe(true);
    if (march31) expect(march31.inMonth).toBe(false);
  });

  it("flags today correctly", () => {
    const now = new Date();
    const days = getCalendarDays(now.getFullYear(), now.getMonth());
    const todayStr = now.toISOString().slice(0, 10);
    const todayCell = days.find((d) => d.date === todayStr);
    expect(todayCell?.isToday).toBe(true);
  });
});
