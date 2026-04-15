import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { fetchAllUsers, formatRoleBadge } from "@/lib/queries/admin";
import { RevokeInstructorButton } from "@/components/admin/revoke-instructor-button";
import { formatDate, cn } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("admin.users");
  const params = await searchParams;
  const q = params.q || "";
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 25;

  const { rows, total } = await fetchAllUsers({
    search: q,
    page,
    pageSize,
  });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">
        {t("title")}
      </h1>
      <p className="text-sm text-charcoal-lighter mb-6">
        {t("total", { count: total })}
      </p>

      <form method="get" className="mb-4 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          className="flex-1 rounded border border-charcoal-lighter/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded bg-primary-400 text-white text-sm font-medium hover:bg-primary-500"
        >
          {t("search")}
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-charcoal-lighter">
          {t("empty")}
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-charcoal-lighter border-b border-charcoal-lighter/10">
              <tr>
                <th className="text-left px-4 py-3">{t("colName")}</th>
                <th className="text-left px-4 py-3">{t("colEmail")}</th>
                <th className="text-left px-4 py-3">{t("colRole")}</th>
                <th className="text-left px-4 py-3">{t("colJoined")}</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-lighter/10">
              {rows.map((u) => {
                const badge = formatRoleBadge(u.role);
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-charcoal">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-charcoal-lighter">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-charcoal-lighter">
                      {formatDate(u.created_at.slice(0, 10), locale)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role === "instructor" && (
                        <RevokeInstructorButton userId={u.id} />
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
                `/admin/users?q=${encodeURIComponent(q)}&page=${p}` as "/admin/users"
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
