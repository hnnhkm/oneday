import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { ApplicationForm } from "@/components/instructor/application-form";
import { getInstructorOnboardingState } from "@/lib/supabase/require-approved-instructor";

export default async function InstructorApplyPage() {
  const locale = await getLocale();
  const t = await getTranslations("instructor.apply");

  const { user, profile } = await getInstructorOnboardingState();

  if (!user) redirect(`/${locale}/login`);

  // Already applied: branch based on current state instead of showing
  // the form a second time.
  if (profile) {
    if (profile.approval_status === "pending") {
      redirect(`/${locale}/instructor/pending`);
    }
    if (profile.approval_status === "rejected") {
      redirect(`/${locale}/instructor/rejected`);
    }
    redirect(`/${locale}/instructor`);
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">
        {t("title")}
      </h1>
      <p className="text-charcoal-lighter mb-6">{t("subtitle")}</p>
      <ApplicationForm />
    </div>
  );
}
