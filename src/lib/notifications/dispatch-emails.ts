import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { renderNotificationEmail } from "@/lib/email-templates/render";
import type { Notification } from "@/lib/types/database";

/**
 * Drains unsent email rows for the given user IDs. Meant to be called
 * "fire and forget" after a server action that has just triggered a
 * notification insert (via one of the Postgres triggers or the
 * cancel_activity_with_refunds function).
 *
 * Uses the service-role admin client so it can:
 *   - read notifications for users other than the caller (e.g. when
 *     a booker's cancel-flow also emails the instructor)
 *   - update `email_sent_at` without hitting RLS
 *   - read users.email for the recipient lookup
 *
 * Dry-run / no-key path logs to the server console — see
 * src/lib/email.ts. Either way the row is stamped so the dispatcher
 * doesn't retry forever.
 *
 * Not transactional: if the email provider flakes we skip the stamp
 * and the next dispatch call will retry. Good enough for Phase 7.
 */
export async function dispatchEmailsForUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  // Dedupe so the same user doesn't get processed twice when both
  // booker and instructor happen to be the same test account.
  const uniq = Array.from(new Set(userIds));

  const admin = createAdminClient();

  const siteOrigin =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Fetch unsent notifications + the matching users.email in one pass
  // per user. We could do it in a single IN query, but batching per
  // user keeps the email-delivery loop simple and isolates failures.
  for (const userId of uniq) {
    const { data: userRow } = await admin
      .from("users")
      .select("id, name, email")
      .eq("id", userId)
      .maybeSingle();
    if (!userRow || !("email" in userRow) || !userRow.email) continue;

    const { data: unsent } = await admin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .is("email_sent_at", null)
      .order("created_at", { ascending: true });

    const rows = (unsent as Notification[]) || [];
    if (rows.length === 0) continue;

    // Honor opt-out per notification_type if the user has a pref row.
    // Default to "send" when no row exists — Phase 7 doesn't have a
    // preferences UI yet, so absence should mean "send me everything".
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("notification_type, email_enabled")
      .eq("user_id", userId);

    const emailDisabled = new Set(
      ((prefs as Array<{
        notification_type: string;
        email_enabled: boolean;
      }>) || [])
        .filter((p) => p.email_enabled === false)
        .map((p) => p.notification_type)
    );

    for (const row of rows) {
      if (emailDisabled.has(row.type)) {
        // User opted out of this type. Stamp so the dispatcher skips
        // it next time — "delivered" in the sense of "decided not
        // to send" rather than "succeeded".
        await admin
          .from("notifications")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }

      const rendered = renderNotificationEmail(
        row,
        (userRow as { name: string }).name || "",
        siteOrigin
      );

      const result = await sendEmail({
        to: (userRow as { email: string }).email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });

      if (result.ok) {
        await admin
          .from("notifications")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", row.id);
      }
      // On send failure: leave email_sent_at null so the next
      // dispatcher call retries. This is good enough for transient
      // failures; permanent bounces would loop forever but we don't
      // have a permanent-failure classifier yet.
    }
  }
}
