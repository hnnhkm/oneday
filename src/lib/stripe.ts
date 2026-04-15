import Stripe from "stripe";
import { isStripeEnabled } from "@/lib/stripe-config";

/**
 * Server-only Stripe client singleton. Callers should first check
 * `isStripeEnabled()` from @/lib/stripe-config and fall back to the
 * mocked payment path if it returns false. `getStripeClient()` throws
 * if called without a key configured — that's a programmer error.
 */

let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!isStripeEnabled()) {
    throw new Error(
      "Stripe is not enabled: set STRIPE_SECRET_KEY in .env.local"
    );
  }
  if (!cached) {
    // Omit explicit apiVersion and let the installed Stripe SDK use
    // its default (pinned by the package version in package.json).
    // Upgrade the SDK deliberately to bump the API version.
    cached = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return cached;
}

export { isStripeEnabled } from "@/lib/stripe-config";
