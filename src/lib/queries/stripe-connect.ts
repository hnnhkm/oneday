import { getStripeClient } from "@/lib/stripe";

/**
 * Server-side Stripe Connect readers. The payouts page uses these
 * to render the connected account's status + transfer history.
 * Both functions assume isStripeEnabled() has already been checked
 * by the caller.
 */

export interface StripeAccountStatus {
  id: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
}

export async function fetchStripeAccountStatus(
  stripeAccountId: string
): Promise<StripeAccountStatus | null> {
  try {
    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(stripeAccountId);
    return {
      id: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
    };
  } catch (err) {
    console.error("[stripe:accounts.retrieve] failed", err);
    return null;
  }
}

export interface StripeTransferRow {
  id: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  description: string | null;
}

export async function fetchStripeTransfers(
  destinationAccountId: string,
  limit: number = 20
): Promise<StripeTransferRow[]> {
  try {
    const stripe = getStripeClient();
    // Stripe's list endpoint accepts `destination` to filter to
    // transfers that went TO a specific connected account.
    const { data } = await stripe.transfers.list({
      destination: destinationAccountId,
      limit,
    });
    return data.map((t) => ({
      id: t.id,
      amountCents: t.amount,
      currency: t.currency,
      createdAt: new Date(t.created * 1000).toISOString(),
      description: t.description,
    }));
  } catch (err) {
    console.error("[stripe:transfers.list] failed", err);
    return [];
  }
}
