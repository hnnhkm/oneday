import {
  computeInstructorEarnings,
  type EarningsBookingRow,
} from "@/lib/instructor-earnings";

/** Default commission: 15% matches the seed data. */
const COMMISSION = 0.15;

function booking(overrides: Partial<EarningsBookingRow>): EarningsBookingRow {
  return {
    status: "confirmed",
    total_price_cents: 10000,
    refund_amount_cents: 0,
    activity_date: "2026-06-15",
    ...overrides,
  };
}

describe("computeInstructorEarnings", () => {
  // Reference "today": Apr 15 2026. Current month window: Apr 1 → Apr 15.
  const today = "2026-04-15";

  it("returns all zeros for an empty booking list", () => {
    const out = computeInstructorEarnings([], COMMISSION, today);
    expect(out).toEqual({
      upcomingNetCents: 0,
      thisMonthNetCents: 0,
      allTimeNetCents: 0,
      upcomingCount: 0,
      thisMonthCount: 0,
      allTimeCount: 0,
    });
  });

  it("counts a future confirmed booking as upcoming only", () => {
    const out = computeInstructorEarnings(
      [booking({ activity_date: "2026-05-01", total_price_cents: 10000 })],
      COMMISSION,
      today
    );
    // 10000 - 15% = 8500 net to instructor.
    expect(out.upcomingNetCents).toBe(8500);
    expect(out.upcomingCount).toBe(1);
    expect(out.thisMonthNetCents).toBe(0);
    expect(out.allTimeNetCents).toBe(0);
  });

  it("counts a past completed booking as earned all-time", () => {
    const out = computeInstructorEarnings(
      [
        booking({
          status: "completed",
          activity_date: "2026-01-10",
          total_price_cents: 20000,
        }),
      ],
      COMMISSION,
      today
    );
    // 20000 - 15% = 17000
    expect(out.allTimeNetCents).toBe(17000);
    expect(out.allTimeCount).toBe(1);
    expect(out.thisMonthNetCents).toBe(0);
    expect(out.upcomingNetCents).toBe(0);
  });

  it("counts a past booking in the current month as both this-month AND all-time", () => {
    const out = computeInstructorEarnings(
      [
        booking({
          status: "completed",
          activity_date: "2026-04-05",
          total_price_cents: 10000,
        }),
      ],
      COMMISSION,
      today
    );
    expect(out.thisMonthNetCents).toBe(8500);
    expect(out.thisMonthCount).toBe(1);
    expect(out.allTimeNetCents).toBe(8500);
    expect(out.allTimeCount).toBe(1);
    expect(out.upcomingNetCents).toBe(0);
  });

  it("treats the reference day itself as 'earned', not 'upcoming'", () => {
    const out = computeInstructorEarnings(
      [
        booking({
          activity_date: today,
          total_price_cents: 10000,
        }),
      ],
      COMMISSION,
      today
    );
    expect(out.thisMonthNetCents).toBe(8500);
    expect(out.upcomingNetCents).toBe(0);
  });

  it("excludes cancelled bookings from every bucket", () => {
    const out = computeInstructorEarnings(
      [
        booking({
          status: "cancelled",
          activity_date: "2026-04-01",
          total_price_cents: 10000,
        }),
        booking({
          status: "cancelled",
          activity_date: "2026-05-01",
          total_price_cents: 10000,
        }),
      ],
      COMMISSION,
      today
    );
    expect(out.upcomingNetCents).toBe(0);
    expect(out.thisMonthNetCents).toBe(0);
    expect(out.allTimeNetCents).toBe(0);
    expect(out.allTimeCount).toBe(0);
  });

  it("subtracts refund amounts before applying commission", () => {
    const out = computeInstructorEarnings(
      [
        booking({
          status: "completed",
          activity_date: "2026-04-10",
          total_price_cents: 10000,
          refund_amount_cents: 4000, // partial refund
        }),
      ],
      COMMISSION,
      today
    );
    // effective: 10000 - 4000 = 6000; net: 6000 - 15% = 5100
    expect(out.allTimeNetCents).toBe(5100);
    expect(out.thisMonthNetCents).toBe(5100);
  });

  it("aggregates across multiple bookings in all three buckets", () => {
    const out = computeInstructorEarnings(
      [
        // Past, last month, earned all-time only
        booking({
          status: "completed",
          activity_date: "2026-03-10",
          total_price_cents: 10000,
        }),
        // Past, this month, counted both
        booking({
          status: "completed",
          activity_date: "2026-04-05",
          total_price_cents: 20000,
        }),
        // Future, upcoming only
        booking({
          activity_date: "2026-05-01",
          total_price_cents: 30000,
        }),
      ],
      COMMISSION,
      today
    );
    expect(out.upcomingNetCents).toBe(25500); // 30000 * 0.85
    expect(out.upcomingCount).toBe(1);
    expect(out.thisMonthNetCents).toBe(17000); // 20000 * 0.85
    expect(out.thisMonthCount).toBe(1);
    expect(out.allTimeNetCents).toBe(25500); // 10000 + 20000 = 30000 * 0.85
    expect(out.allTimeCount).toBe(2);
  });

  it("handles a 0% commission rate (no platform fee)", () => {
    const out = computeInstructorEarnings(
      [booking({ status: "completed", activity_date: "2026-04-05" })],
      0,
      today
    );
    expect(out.thisMonthNetCents).toBe(10000);
    expect(out.allTimeNetCents).toBe(10000);
  });

  it("a fully-refunded past booking still contributes 0, not negative", () => {
    const out = computeInstructorEarnings(
      [
        booking({
          status: "completed",
          activity_date: "2026-04-10",
          total_price_cents: 10000,
          refund_amount_cents: 10000,
        }),
      ],
      COMMISSION,
      today
    );
    expect(out.allTimeNetCents).toBe(0);
    expect(out.thisMonthNetCents).toBe(0);
    // The booking still counts toward allTimeCount because it
    // existed — but earnings math zeroes out.
    expect(out.allTimeCount).toBe(1);
  });
});
