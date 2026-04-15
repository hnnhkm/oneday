import type { TranslatedField } from "@/lib/types/database";

/**
 * Pure helpers for Stripe Checkout integration. Split out from
 * src/lib/stripe.ts (which instantiates the Stripe SDK and can't
 * run in the Jest/client environment) so we can unit-test the shape
 * of the data going into a Checkout session without mocking the
 * entire SDK.
 */

/**
 * Is Stripe actually configured? Returns true iff the secret key
 * env var is present and isn't the .env.example placeholder. The
 * rest of the codebase branches on this: false → run the mocked
 * payment path shipped in Phase 4, true → redirect to real Stripe
 * Checkout.
 */
export function isStripeEnabled(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;
  if (key === "your_stripe_secret_key") return false;
  return key.length > 0;
}

export interface CheckoutLineItem {
  price_data: {
    currency: "brl";
    product_data: {
      name: string;
      description: string;
      images?: string[];
    };
    unit_amount: number;
  };
  quantity: number;
}

interface ActivityForCheckout {
  id: string;
  title: TranslatedField;
  price_cents: number;
  cover_image_url: string;
  date: string;
  time: string;
}

/**
 * Build a Stripe Checkout `line_items` array from an activity +
 * seat count. We use a single line item with `quantity = seats`
 * rather than N identical items so the Stripe dashboard shows one
 * row per activity. The per-seat price is `unit_amount` in cents.
 *
 * Dates go into the description in a human-readable pt-BR format —
 * Stripe shows the description on the checkout page, so this is
 * where the activity date surfaces to the buyer.
 */
export function buildCheckoutLineItems(
  activity: ActivityForCheckout,
  seats: number,
  locale: "pt" | "en" | "es"
): CheckoutLineItem[] {
  const name = activity.title[locale] || activity.title.pt || "Atividade";
  const description = `${formatDateForCheckout(activity.date)} · ${activity.time.slice(0, 5)}`;

  const productData: CheckoutLineItem["price_data"]["product_data"] = {
    name,
    description,
  };
  if (activity.cover_image_url) {
    productData.images = [activity.cover_image_url];
  }

  return [
    {
      price_data: {
        currency: "brl",
        product_data: productData,
        unit_amount: activity.price_cents,
      },
      quantity: seats,
    },
  ];
}

function formatDateForCheckout(iso: string): string {
  // Simple dd/mm/yyyy formatter — Stripe doesn't need locale-aware
  // formatting here, and pt-BR is the primary market.
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
