import { computeApplicationFeeCents } from "@/lib/commission";

/**
 * Pure calculator for the "earnings summary" widget on the
 * instructor payouts page. Splits a booking list into three
 * buckets — upcoming, this-month earned, and all-time earned — and
 * computes the net cents payable to the instructor after the
 * platform commission and any refunds.
 *
 * Kept server-free and dependency-free so it's cheap to unit-test
 * and reusable anywhere (dashboard home, emails, exports).
 *
 * Semantics (assuming `today` = `YYYY-MM-DD`):
 *   - upcoming:     activity_date >  today,       status != cancelled
 *   - thisMonth:    activity_date in [first-of-month .. today],
 *                                                status != cancelled
 *   - allTime:      activity_date <= today,       status != cancelled
 *
 * "Earned" means the activity has already happened — which is when
 * the instructor actually has money to claim. "Upcoming" is the
 * seats-sold-for-future-dates book. `thisMonth` is a strict subset
 * of `allTime`, so callers can show both without double counting.
 *
 * Refunds are subtracted from total_price_cents *before* the
 * commission is applied, matching how Stripe's
 * `refund_application_fee: true` reverses the platform fee
 * proportionally.
 */
export interface EarningsBookingRow {
  status: "confirmed" | "cancelled" | "completed";
  total_price_cents: number;
  refund_amount_cents: number;
  /** YYYY-MM-DD for the activity the booking is attached to. */
  activity_date: string;
}

export interface InstructorEarnings {
  upcomingNetCents: number;
  thisMonthNetCents: number;
  allTimeNetCents: number;
  upcomingCount: number;
  thisMonthCount: number;
  allTimeCount: number;
}

/**
 * Compute the net (after commission) earnings for a single booking.
 * Clamps negative values to 0 — a booking that's been fully refunded
 * can't put the instructor in the red.
 */
function netCentsForBooking(
  row: EarningsBookingRow,
  commissionRate: number
): number {
  const effective = row.total_price_cents - row.refund_amount_cents;
  if (effective <= 0) return 0;
  const fee = computeApplicationFeeCents(effective, commissionRate);
  return Math.max(0, effective - fee);
}

export function computeInstructorEarnings(
  bookings: EarningsBookingRow[],
  commissionRate: number,
  today: string
): InstructorEarnings {
  const firstOfMonth = today.slice(0, 7) + "-01";

  let upcomingNetCents = 0;
  let thisMonthNetCents = 0;
  let allTimeNetCents = 0;
  let upcomingCount = 0;
  let thisMonthCount = 0;
  let allTimeCount = 0;

  for (const b of bookings) {
    if (b.status === "cancelled") continue;

    const net = netCentsForBooking(b, commissionRate);

    if (b.activity_date > today) {
      upcomingNetCents += net;
      upcomingCount += 1;
    } else {
      // activity_date <= today → earned
      allTimeNetCents += net;
      allTimeCount += 1;
      if (b.activity_date >= firstOfMonth) {
        thisMonthNetCents += net;
        thisMonthCount += 1;
      }
    }
  }

  return {
    upcomingNetCents,
    thisMonthNetCents,
    allTimeNetCents,
    upcomingCount,
    thisMonthCount,
    allTimeCount,
  };
}
