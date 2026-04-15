import type { CancellationPolicy } from "@/lib/types/database";

/**
 * Pure helper translating a cancellation_policy enum + time-until-start
 * into a refund amount in cents. Lives in its own module so both the
 * server cancel action and the client confirm dialog can import it
 * without pulling in server-only deps.
 *
 * Policy definitions mirror the i18n text shipped in Phase 2:
 *
 *   flexible  — full refund up to 24h before
 *   moderate  — full refund 48h+, 50% 24–48h
 *   strict    — full refund 7+ days, 50% 2–7 days
 *
 * Once the activity has started (hoursUntilStart < 0), the refund is
 * always zero regardless of policy — we don't retroactively punish
 * people who didn't show up, but we also don't give them their money
 * back after the fact.
 */

export interface RefundInput {
  policy: CancellationPolicy;
  hoursUntilStart: number;
  totalPriceCents: number;
}

export function computeRefundCents(input: RefundInput): number {
  const { policy, hoursUntilStart, totalPriceCents } = input;
  if (hoursUntilStart < 0) return 0;

  const ratio = refundRatio(policy, hoursUntilStart);
  // Round-half-up so split bookings refund predictably.
  return Math.round(totalPriceCents * ratio);
}

function refundRatio(
  policy: CancellationPolicy,
  hoursUntilStart: number
): number {
  switch (policy) {
    case "flexible":
      return hoursUntilStart >= 24 ? 1 : 0;
    case "moderate":
      if (hoursUntilStart >= 48) return 1;
      if (hoursUntilStart >= 24) return 0.5;
      return 0;
    case "strict":
      if (hoursUntilStart >= 168) return 1;
      if (hoursUntilStart >= 48) return 0.5;
      return 0;
    default:
      // Unknown policy = be conservative and give nothing rather than
      // leak the full amount. The enum is exhaustive so this branch
      // is effectively unreachable.
      return 0;
  }
}

/**
 * Convenience: how many hours until a local activity date+time?
 * Both `date` (YYYY-MM-DD) and `time` (HH:MM or HH:MM:SS) come out
 * of Postgres as strings; we assume the activity's "local" timezone
 * matches the server's. Good enough for Phase 11; real timezone
 * handling is a separate concern.
 */
export function hoursUntilStart(
  date: string,
  time: string,
  now: Date = new Date()
): number {
  const hhmm = time.slice(0, 5);
  const dt = new Date(`${date}T${hhmm}:00`);
  return (dt.getTime() - now.getTime()) / (60 * 60 * 1000);
}

/**
 * Companion to `hoursUntilStart` that works off a TIMESTAMPTZ string
 * (the `activity_sessions.starts_at` shape). Avoids the implicit
 * server-local timezone assumption `hoursUntilStart(date, time)` has
 * to live with because legacy `activities.date/time` are naïve.
 * Prefer this for any path with a session in hand.
 */
export function hoursUntilStartFromTimestamp(
  startsAt: string,
  now: Date = new Date()
): number {
  return (new Date(startsAt).getTime() - now.getTime()) / (60 * 60 * 1000);
}
