/**
 * Pure helper: what portion of a checkout total is the platform
 * fee, expressed in cents?
 *
 * commission_rate lives on instructor_profiles as a DECIMAL(5,4)
 * with a default of 0.15 — Stripe needs an integer cent amount
 * for application_fee_amount on the Checkout session, so we
 * round half-up.
 *
 * Guards:
 *   - A zero or negative total returns 0 (don't bill a refund).
 *   - A commission rate >= 1 caps at the total so we never
 *     over-bill even if someone mis-sets the column.
 */
export function computeApplicationFeeCents(
  totalCents: number,
  commissionRate: number
): number {
  if (totalCents <= 0) return 0;
  if (commissionRate <= 0) return 0;
  if (commissionRate >= 1) return totalCents;
  return Math.round(totalCents * commissionRate);
}
