import { createClient } from "@/lib/supabase/server";
import type { NotificationType, NotificationPreference } from "@/lib/types/database";

/**
 * Fetch the user's notification preferences. Returns a Map from
 * notification_type → email_enabled. Types not in the map default
 * to true (the dispatcher's convention).
 */
export async function fetchNotificationPreferences(
  userId: string
): Promise<Map<NotificationType, boolean>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("notification_type, email_enabled")
    .eq("user_id", userId);

  const map = new Map<NotificationType, boolean>();
  for (const row of (data || []) as Pick<NotificationPreference, "notification_type" | "email_enabled">[]) {
    map.set(row.notification_type, row.email_enabled);
  }
  return map;
}
