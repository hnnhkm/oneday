"use server";

import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/types/database";
import type { ActionResult } from "@/lib/actions/account";

/**
 * Toggle email notifications for a specific notification type.
 * Upserts: if no preference row exists, creates one; if it does,
 * updates email_enabled. The unique constraint on
 * (user_id, notification_type) ensures at most one row per pair.
 */
export async function toggleEmailPreferenceAction(
  notificationType: NotificationType,
  enabled: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        notification_type: notificationType,
        email_enabled: enabled,
        in_app_enabled: true,
        whatsapp_enabled: false,
      },
      { onConflict: "user_id,notification_type" }
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
