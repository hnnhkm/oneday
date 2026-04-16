import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/supabase/get-user";
import { fetchNotificationPreferences } from "@/lib/queries/notification-preferences";
import { fetchInstructorProfileByUserId } from "@/lib/queries/instructor";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";

export default async function NotificationPreferencesPage() {
  const locale = await getLocale();
  const t = await getTranslations("notificationPreferences");
  const tNav = await getTranslations("nav");
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
      {/* Back link to the settings hub. Without this the only way
          out of the sub-page is the bottom nav, which feels stranded
          — `Perfil` routes back here anyway, so a dedicated link
          makes the hierarchy visible. */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-charcoal-lighter hover:text-charcoal mb-4"
      >
        ← {tNav("settings")}
      </Link>
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
