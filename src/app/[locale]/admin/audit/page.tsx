import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { fetchAdminActions } from "@/lib/queries/admin";
import { formatDate, cn } from "@/lib/utils";

const ACTION_TYPES = [
  "all",
  "instructor_approve",
  "instructor_reject",
  "instructor_revoke",
  "activity_force_cancel",
] as const;

interface Props {
  searchParams: Promise<{ type?: string; page?: string }>;
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("admin.audit");
  const params = await searchParams;

  const actionType = (ACTION_TYPES as readonly string[]).includes(
    params.type || ""
  )
    ? (params.type as string)
    : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 25;

  const { rows, total } = await fetchAdminActions({
    actionType,
    page,
    pageSize,
  });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">
        {t("title")}
      </h1>
      <p className="text-sm text-charcoal-lighter mb-4">
        {t("total", { count: total })}
      </p>

      <div className="flex gap-2 border-b border-charcoal-lighter/10 mb-6 overflow-x-auto">
        {ACTION_TYPES.map((type) => (
          <Link
            key={type}
            href={`/admin/audit?type=${type}` as "/admin/audit"}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              actionType === type
                ? "border-primary-400 text-primary-400"
                : "border-transparent text-charcoal-lighter hover:text-charcoal"
            )}
          >
            {t(`filter.${type}` as "filter.all")}
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
                <th className="text-left px-4 py-3">{t("colWhen")}</th>
                <th className="text-left px-4 py-3">{t("colAdmin")}</th>
                <th className="text-left px-4 py-3">{t("colAction")}</th>
                <th className="text-left px-4 py-3">{t("colTarget")}</th>
                <th className="text-left px-4 py-3">{t("colMetadata")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-lighter/10">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-charcoal-lighter whitespace-nowrap">
                    {formatDate(row.created_at.slice(0, 10), locale)}
                    <br />
                    <span className="text-xs">
                      {row.created_at.slice(11, 19)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-charcoal">
                    {row.admin_name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        actionBadgeClass(row.action_type)
                      )}
                    >
                      {t(`action.${row.action_type}` as "action.instructor_approve")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-charcoal-lighter">
                      {row.target_type}
                    </div>
                    <div className="font-mono text-xs text-charcoal">
                      {row.target_id.slice(0, 8)}…
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <pre className="text-xs text-charcoal-lighter whitespace-pre-wrap max-w-md">
                      {Object.keys(row.metadata).length > 0
                        ? JSON.stringify(row.metadata, null, 2)
                        : "—"}
                    </pre>
                  </td>
                </tr>
              ))}
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
                `/admin/audit?type=${actionType}&page=${p}` as "/admin/audit"
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

function actionBadgeClass(actionType: string): string {
  switch (actionType) {
    case "instructor_approve":
      return "bg-secondary-50 text-secondary-700";
    case "instructor_reject":
    case "instructor_revoke":
    case "activity_force_cancel":
      return "bg-red-50 text-red-700";
    default:
      return "bg-background-muted text-charcoal-lighter";
  }
}
