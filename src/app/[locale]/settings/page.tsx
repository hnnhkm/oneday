import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/supabase/get-user";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = await getTranslations("settings");
  const tSaved = await getTranslations("savedSearches");
  const tNotif = await getTranslations("notificationPreferences");
  const user = await getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-8">
        {t("title")}
      </h1>
      <ProfileForm user={user} />

      <div className="mt-8 pt-8 border-t border-charcoal-lighter/10 space-y-3">
        <Link
          href="/settings/notifications"
          className="flex items-center justify-between rounded-lg bg-white shadow-card p-4 hover:shadow-card-hover transition-shadow"
        >
          <div>
            <div className="font-medium text-charcoal">
              🔔 {tNotif("title")}
            </div>
            <div className="text-sm text-charcoal-lighter mt-0.5">
              {tNotif("subtitle")}
            </div>
          </div>
          <span className="text-charcoal-lighter">→</span>
        </Link>
        <Link
          href="/settings/saved-searches"
          className="flex items-center justify-between rounded-lg bg-white shadow-card p-4 hover:shadow-card-hover transition-shadow"
        >
          <div>
            <div className="font-medium text-charcoal">
              🔍 {tSaved("pageTitle")}
            </div>
            <div className="text-sm text-charcoal-lighter mt-0.5">
              {tSaved("emptyHint")}
            </div>
          </div>
          <span className="text-charcoal-lighter">→</span>
        </Link>
      </div>
    </div>
  );
}
