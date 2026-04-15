"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeEnabled } from "@/lib/stripe-config";
import { getStripeClient } from "@/lib/stripe";
import type { ActionResult } from "@/lib/actions/account";

/**
 * Stripe Connect Express onboarding actions.
 *
 * The flow:
 *   1. Instructor lands on /instructor/payouts
 *   2. If no stripe_account_id, they click "Conectar ao Stripe"
 *      which calls startInstructorOnboardingAction() — creates a
 *      Connect Express account, stamps the id on their profile,
 *      and returns an Account Link URL for the hosted onboarding.
 *   3. Stripe redirects back to /instructor/payouts/return
 *   4. refreshStripeAccountStatusAction() re-fetches the account
 *      and updates our UI. We don't mirror every status field —
 *      we always read fresh from Stripe on the payouts page.
 *
 * Graceful fallback: if Stripe is not enabled (no secret key),
 * both actions return ok:false with a helpful error so the UI
 * can show "Stripe não configurado" instead of silently failing.
 */

async function requireApprovedInstructorInAction(): Promise<
  | { ok: true; profileId: string; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("instructor_profiles")
    .select("id, approval_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "No instructor profile" };
  if (profile.approval_status !== "approved") {
    return { ok: false, error: "Application not approved" };
  }
  return { ok: true, profileId: profile.id as string, userId: user.id };
}

export async function startInstructorOnboardingAction(): Promise<
  ActionResult & { url?: string }
> {
  if (!isStripeEnabled()) {
    return { ok: false, error: "stripe_not_configured" };
  }

  const auth = await requireApprovedInstructorInAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("instructor_profiles")
    .select("id, stripe_account_id")
    .eq("id", auth.profileId)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Profile not found" };

  // Reuse an existing Stripe account if one exists — multiple
  // create calls would orphan the earlier accounts and drift our
  // local stripe_account_id out of sync with what the instructor
  // has actually onboarded.
  let stripeAccountId =
    (profile as { stripe_account_id: string | null }).stripe_account_id;

  try {
    const stripe = getStripeClient();

    if (!stripeAccountId) {
      // Fetch user email for prefill; the account doesn't strictly
      // need it but it saves the instructor a step.
      const {
        data: { user },
      } = await (await createClient()).auth.getUser();
      const email = user?.email || undefined;

      const account = await stripe.accounts.create({
        type: "express",
        country: "BR",
        email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
      });
      stripeAccountId = account.id;

      await admin
        .from("instructor_profiles")
        .update({ stripe_account_id: stripeAccountId })
        .eq("id", auth.profileId);
    }

    const hdrs = await headers();
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
    const proto = hdrs.get("x-forwarded-proto") || "http";
    const origin =
      process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : "");

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/pt/instructor/payouts`,
      return_url: `${origin}/pt/instructor/payouts/return`,
      type: "account_onboarding",
    });

    return { ok: true, url: accountLink.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "stripe_error";
    console.error("[stripe:connect:onboarding]", err);
    return { ok: false, error: message };
  }
}

export async function refreshStripeAccountStatusAction(): Promise<ActionResult> {
  if (!isStripeEnabled()) {
    return { ok: false, error: "stripe_not_configured" };
  }

  const auth = await requireApprovedInstructorInAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  // Status lives on Stripe; we just need to bust the page cache
  // so the server component re-fetches on next render.
  revalidatePath("/instructor/payouts");
  return { ok: true };
}
