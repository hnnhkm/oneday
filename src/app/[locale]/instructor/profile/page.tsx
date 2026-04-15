import { getTranslations } from "next-intl/server";
import { requireApprovedInstructor } from "@/lib/supabase/require-approved-instructor";
import { EditProfileForm } from "@/components/instructor/edit-profile-form";

export default async function InstructorProfilePage() {
  const t = await getTranslations("instructor.profile");
  const { profile } = await requireApprovedInstructor();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">
        {t("title")}
      </h1>
      <p className="text-sm text-charcoal-lighter mb-6">{t("subtitle")}</p>
      <EditProfileForm
        initial={{
          bio: profile.bio,
          specialties: profile.specialties,
          social_links: profile.social_links,
          id_document_url: profile.id_document_url,
        }}
      />
    </div>
  );
}
