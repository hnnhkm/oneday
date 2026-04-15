"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEmailsForUsers } from "@/lib/notifications/dispatch-emails";
import { isStripeEnabled } from "@/lib/stripe-config";
import { getStripeClient } from "@/lib/stripe";
import type { ActionResult } from "@/lib/actions/account";

/**
 * Admin actions are gated by an inline role check against the
 * authenticated session. `requireAdmin()` isn't importable here
 * because it uses the next-intl server helpers that can't run
 * inside a server action — the inline check reads users.role
 * directly.
 */
async function assertAdmin(): Promise<
  { ok: true; adminUserId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const { data: row } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((row as { role: string } | null)?.role !== "admin") {
    return { ok: false, error: "Not authorized" };
  }
  return { ok: true, adminUserId: user.id };
}

/**
 * Revoke instructor status: flip the user's role back to 'user'.
 * The instructor_profiles row stays (don't cascade-delete their
 * activities), so if they re-apply later the profile is reused
 * and the admin can re-approve from /admin/applications.
 */
export async function demoteInstructorAction(
  userId: string
): Promise<ActionResult> {
  const check = await assertAdmin();
  if (!check.ok) return { ok: false, error: check.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ role: "user" })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await admin.from("admin_actions").insert({
    admin_user_id: check.adminUserId,
    action_type: "instructor_revoke",
    target_type: "user",
    target_id: userId,
    metadata: {},
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Admin-path activity cancel. Mirrors cancelActivityAction on the
 * instructor side but uses the admin_cancel_activity_with_refunds
 * RPC which skips the instructor ownership check.
 *
 * Snapshots affected booker user_ids + Stripe payment intents
 * BEFORE the RPC runs (same reason as the instructor path: the
 * post-RPC rows lose the status linkage we need to refund).
 */
export async function adminCancelActivityAction(
  activityId: string,
  reason: string
): Promise<ActionResult & { affectedBookings?: number }> {
  const check = await assertAdmin();
  if (!check.ok) return { ok: false, error: check.error };

  const admin = createAdminClient();

  const { data: bookingsBefore } = await admin
    .from("bookings")
    .select("user_id, stripe_payment_id")
    .eq("activity_id", activityId)
    .neq("status", "cancelled");
  const snapshot =
    (bookingsBefore as Array<{
      user_id: string;
      stripe_payment_id: string | null;
    }>) || [];
  const affectedUserIds = Array.from(new Set(snapshot.map((b) => b.user_id)));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "admin_cancel_activity_with_refunds",
    {
      p_activity_id: activityId,
      p_reason: reason?.trim() || null,
    }
  );
  if (error) return { ok: false, error: error.message };

  if (isStripeEnabled()) {
    const stripe = getStripeClient();
    for (const b of snapshot) {
      if (!b.stripe_payment_id) continue;
      try {
        await stripe.refunds.create({
          payment_intent: b.stripe_payment_id,
          reverse_transfer: true,
          refund_application_fee: true,
        });
      } catch (err) {
        console.error(
          "[admin:stripe:refund] failed",
          b.stripe_payment_id,
          err
        );
      }
    }
  }

  await dispatchEmailsForUsers(affectedUserIds);

  await admin.from("admin_actions").insert({
    admin_user_id: check.adminUserId,
    action_type: "activity_force_cancel",
    target_type: "activity",
    target_id: activityId,
    metadata: {
      reason: reason?.trim() || null,
      affected_bookings: typeof data === "number" ? data : 0,
    },
  });

  revalidatePath("/admin/activities");
  revalidatePath("/admin");
  revalidatePath("/activities");
  return {
    ok: true,
    affectedBookings: typeof data === "number" ? data : 0,
  };
}

/**
 * Toggle whether a category appears in the homepage CategoryGrid.
 * The full taxonomy stays intact for the search bar / filter panel /
 * instructor forms — this flag only gates the home strip.
 *
 * Writes through the admin client so it bypasses RLS, but only after
 * assertAdmin() confirms the caller is a staff user. Revalidates the
 * homepage (root path) so the new curation shows up immediately.
 */
export async function setCategoryHomeVisibilityAction(
  categoryId: string,
  showOnHome: boolean
): Promise<ActionResult> {
  const check = await assertAdmin();
  if (!check.ok) return { ok: false, error: check.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("categories")
    .update({ show_on_home: showOnHome })
    .eq("id", categoryId);
  if (error) return { ok: false, error: error.message };

  // Homepage is locale-prefixed; revalidatePath("/", "layout") catches
  // every locale variant in one shot. /admin/categories refreshes the
  // admin list so the toggle state re-reads from the DB after save.
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
  return { ok: true };
}

/**
 * Toggle whether an activity appears in the homepage "Atividades em
 * destaque" strip. Mirrors setCategoryHomeVisibilityAction but writes
 * to activities.featured_on_home (added in migration 00026).
 *
 * Defaults to false for new rows since activities are instructor-
 * authored — admins opt each one in from /admin/activities.
 */
export async function setActivityFeaturedOnHomeAction(
  activityId: string,
  featuredOnHome: boolean
): Promise<ActionResult> {
  const check = await assertAdmin();
  if (!check.ok) return { ok: false, error: check.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("activities")
    .update({ featured_on_home: featuredOnHome })
    .eq("id", activityId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/admin/activities");
  return { ok: true };
}
