import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireApprovedInstructor } from "@/lib/supabase/require-approved-instructor";
import { refreshStripeAccountStatusAction } from "@/lib/actions/stripe-connect";

/**
 * Landing page after Stripe finishes the Connect Express
 * onboarding redirect. We bust the payouts page cache via the
 * server action, then bounce the user back there so they see
 * their fresh status without a manual refresh.
 */
export default async function PayoutsReturnPage() {
  const locale = await getLocale();
  await requireApprovedInstructor();
  await refreshStripeAccountStatusAction();
  redirect(`/${locale}/instructor/payouts`);
}
