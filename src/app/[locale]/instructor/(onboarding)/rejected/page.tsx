import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getInstructorOnboardingState } from "@/lib/supabase/require-approved-instructor";

export default async function InstructorRejectedPage() {
  const locale = await getLocale();
  const t = await getTranslations("instructor.rejected");

  const { user, profile } = await getInstructorOnboardingState();
  if (!user) redirect(`/${locale}/login`);
  if (!profile) redirect(`/${locale}/instructor/apply`);
  if (profile.approval_status === "approved") {
    redirect(`/${locale}/instructor`);
  }
  if (profile.approval_status === "pending") {
    redirect(`/${locale}/instructor/pending`);
  }

  return (
    <div className="text-center">
      <div className="text-6xl mb-4" aria-hidden>
        🙁
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-3">
        {t("title")}
      </h1>
      <p className="text-charcoal-lighter mb-6">{t("body")}</p>
      {profile.rejection_reason && (
        <div className="mx-auto max-w-md mb-6 text-left rounded-md bg-background-muted px-4 py-3">
          <div className="text-xs font-medium text-charcoal-lighter mb-1">
            {t("reasonLabel")}
          </div>
          <div className="text-sm text-charcoal">
            {profile.rejection_reason}
          </div>
        </div>
      )}
      <Link href="/">
        <Button variant="outline">{t("cta")}</Button>
      </Link>
    </div>
  );
}
