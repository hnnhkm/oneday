"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/account";

/**
 * Mark a single notification as read. RLS on notifications already
 * enforces that a user can only UPDATE their own rows, so we don't
 * re-check user_id in application code — the `.eq('id', ...)` filter
 * combined with the RLS policy is sufficient.
 */
export async function markNotificationReadAction(
  notificationId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/instructor/notifications");
  return { ok: true };
}

/**
 * Mark all of the current user's notifications as read in a single
 * query. Used by the "mark all as read" button on the notifications
 * page.
 */
export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/instructor/notifications");
  return { ok: true };
}
