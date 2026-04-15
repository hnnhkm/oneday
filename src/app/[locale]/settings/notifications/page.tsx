import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getUser } from "@/lib/supabase/get-user";
import { fetchNotificationPreferences } from "@/lib/queries/notification-preferences";
import { fetchInstructorProfileByUserId } from "@/lib/queries/instructor";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";

export default async function NotificationPreferencesPage() {
  const locale = await getLocale();
  const t = await getTranslations("notificationPreferences");
  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);

  const [preferences, profile] = await Promise.all([
    fetchNotificationPreferences(user.id),
    fetchInstructorProfileByUserId(user.id),
  ]);

  const isInstructor =
    !!profile && profile.approval_status === "approved";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-charcoal mb-2">
        {t("title")}
      </h1>
      <p className="text-sm text-charcoal-lighter mb-6">
        {t("subtitle")}
      </p>
      <NotificationPreferencesForm
        preferences={preferences}
        isInstructor={isInstructor}
      />
    </div>
  );
}
