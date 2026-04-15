import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ActivityGrid } from "@/components/activities/activity-grid";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/get-user";
import { fetchUserFavorites } from "@/lib/queries/favorites";

export default async function FavoritesPage() {
  const locale = await getLocale();
  const t = await getTranslations("favorites");

  const user = await getUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const activities = await fetchUserFavorites(user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
        {t("title")}
      </h1>

      {activities.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💛</div>
          <h2 className="text-xl font-semibold text-charcoal mb-2">
            {t("emptyTitle")}
          </h2>
          <p className="text-charcoal-lighter mb-6">{t("emptyDesc")}</p>
          <Link href="/activities">
            <Button>{t("emptyCta")}</Button>
          </Link>
        </div>
      ) : (
        <ActivityGrid activities={activities} locale={locale} />
      )}
    </div>
  );
}
