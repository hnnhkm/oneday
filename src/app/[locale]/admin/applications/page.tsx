import { getTranslations } from "next-intl/server";
import { fetchPendingApplicationsForAdmin } from "@/lib/queries/admin";
import { AdminApprovalRow } from "@/components/admin/admin-approval-row";

export default async function AdminApplicationsPage() {
  const t = await getTranslations("admin.applications");
  const rows = await fetchPendingApplicationsForAdmin();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">
        {t("title")}
      </h1>
      <p className="text-sm text-charcoal-lighter mb-6">{t("subtitle")}</p>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-charcoal-lighter">
          {t("empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((r) => (
            <AdminApprovalRow
              key={r.id}
              profileId={r.id}
              name={r.users.name}
              email={r.users.email}
              bio={r.bio}
              specialties={r.specialties}
            />
          ))}
        </div>
      )}
    </div>
  );
}
