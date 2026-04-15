import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getUser } from "@/lib/supabase/get-user";
import { fetchUserNotifications } from "@/lib/queries/notifications";
import { NotificationRow } from "@/components/notifications/notification-row";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { formatDate } from "@/lib/utils";

export default async function NotificationsPage() {
  const locale = await getLocale();
  const t = await getTranslations("notifications");

  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);

  const { rows, unread } = await fetchUserNotifications(user.id, 1, 50);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-charcoal">
          {t("title")}
        </h1>
        <MarkAllReadButton unread={unread} />
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-charcoal-lighter">{t("empty")}</p>
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow-card divide-y divide-charcoal-lighter/10">
          {rows.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              dateLabel={formatDate(n.created_at.slice(0, 10), locale)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
