import { getTranslations, getLocale } from "next-intl/server";
import { requireApprovedInstructor } from "@/lib/supabase/require-approved-instructor";
import { fetchInstructorNotifications } from "@/lib/queries/instructor";
import { formatDate } from "@/lib/utils";

export default async function InstructorNotificationsPage() {
  const locale = await getLocale();
  const t = await getTranslations("instructor.notifications");
  const { user } = await requireApprovedInstructor();

  const { rows } = await fetchInstructorNotifications(user.id, 1, 20);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
        {t("title")}
      </h1>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-charcoal-lighter">
          {t("empty")}
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow-card divide-y divide-charcoal-lighter/10">
          {rows.map((n) => (
            <div key={n.id} className="p-4">
              <div className="font-medium text-charcoal">{n.title}</div>
              <div className="text-sm text-charcoal-lighter">{n.body}</div>
              <div className="text-xs text-charcoal-lighter mt-1">
                {formatDate(n.created_at.slice(0, 10), locale)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
