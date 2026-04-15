import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { fetchAllActivities } from "@/lib/queries/admin";
import { AdminCancelActivityButton } from "@/components/admin/admin-cancel-activity-button";
import { AdminActivityFeatureToggle } from "@/components/admin/admin-activity-feature-toggle";
import {
  formatCurrency,
  formatDate,
  getTranslatedField,
  cn,
} from "@/lib/utils";
import type { ActivityStatus, TranslatedField } from "@/lib/types/database";

const STATUSES: Array<ActivityStatus | "all"> = [
  "all",
  "draft",
  "published",
  "cancelled",
  "completed",
];

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminActivitiesPage({ searchParams }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("admin.activities");
  const params = await searchParams;
  const status = (STATUSES as string[]).includes(params.status || "")
    ? (params.status as ActivityStatus | "all")
    : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 25;

  const { rows, total } = await fetchAllActivities({
    status,
    page,
    pageSize,
  });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">
        {t("title")}
      </h1>
      <p className="text-sm text-charcoal-lighter mb-4">
        {t("total", { count: total })}
      </p>

      <div className="flex gap-2 border-b border-charcoal-lighter/10 mb-6 overflow-x-auto">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/activities?status=${s}` as "/admin/activities"}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              status === s
                ? "border-primary-400 text-primary-400"
                : "border-transparent text-charcoal-lighter hover:text-charcoal"
            )}
          >
            {t(
              ("tab" + s.charAt(0).toUpperCase() + s.slice(1)) as
                | "tabAll"
                | "tabDraft"
                | "tabPublished"
                | "tabCancelled"
                | "tabCompleted"
            )}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-charcoal-lighter">
          {t("empty")}
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-charcoal-lighter border-b border-charcoal-lighter/10">
              <tr>
                <th className="text-left px-4 py-3">{t("colTitle")}</th>
                <th className="text-left px-4 py-3">{t("colInstructor")}</th>
                <th className="text-left px-4 py-3">{t("colDate")}</th>
                <th className="text-left px-4 py-3">{t("colPrice")}</th>
                <th className="text-left px-4 py-3">{t("colStatus")}</th>
                <th className="text-center px-4 py-3">{t("colHome")}</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-lighter/10">
              {rows.map((a) => {
                const cancellable =
                  a.status === "published" && a.date >= today;
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium text-charcoal max-w-xs truncate">
                      {getTranslatedField(a.title as TranslatedField, locale)}
                    </td>
                    <td className="px-4 py-3 text-charcoal-lighter">
                      {a.instructor_name}
                    </td>
                    <td className="px-4 py-3 text-charcoal-lighter">
                      {formatDate(a.date, locale)}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(a.price_cents)}
                    </td>
                    <td className="px-4 py-3 capitalize">{a.status}</td>
                    <td className="px-4 py-3">
                      <AdminActivityFeatureToggle
                        activityId={a.id}
                        title={getTranslatedField(
                          a.title as TranslatedField,
                          locale
                        )}
                        initialFeatured={a.featured_on_home}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {cancellable && (
                        <AdminCancelActivityButton activityId={a.id} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={
                `/admin/activities?status=${status}&page=${p}` as "/admin/activities"
              }
              className={cn(
                "px-3 py-1 rounded",
                p === page
                  ? "bg-primary-400 text-white"
                  : "text-charcoal hover:bg-background-muted"
              )}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
