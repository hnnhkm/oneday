import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types/database";

/**
 * Shared notifications reader used by both /instructor/notifications
 * and /notifications. The notifications table has a single user_id
 * column — instructors and regular users are just different recipients,
 * there's no second "owner" field to key off — so one query covers
 * both surfaces.
 */
export async function fetchUserNotifications(
  userId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ rows: Notification[]; total: number; unread: number }> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  // A separate count for the unread badge so we don't have to pull
  // the whole set when the caller only wants the number.
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  return {
    rows: (data as Notification[]) || [],
    total: count || 0,
    unread: unreadCount || 0,
  };
}
