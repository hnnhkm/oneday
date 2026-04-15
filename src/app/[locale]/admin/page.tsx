import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { StatCard } from "@/components/instructor/stat-card";
import { fetchAdminDashboardStats } from "@/lib/queries/admin";
import { formatCurrency } from "@/lib/utils";

/**
 * Admin home. Re-uses the StatCard component shipped for the
 * instructor dashboard in Phase 5 so both surfaces have the same
 * visual language.
 */
export default async function AdminDashboardPage() {
  const t = await getTranslations("admin.dashboard");
  const stats = await fetchAdminDashboardStats();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
        {t("title")}
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="👥"
          label={t("statUsers")}
          value={String(stats.userCount)}
        />
        <StatCard
          icon="🎨"
          label={t("statInstructors")}
          value={String(stats.instructorCount)}
          sub={
            stats.pendingApplicationCount > 0
              ? t("pendingApps", { count: stats.pendingApplicationCount })
              : undefined
          }
        />
        <StatCard
          icon="📅"
          label={t("statActivities")}
          value={String(stats.publishedActivityCount)}
          sub={t("outOfTotal", { count: stats.activityCount })}
        />
        <StatCard
          icon="💰"
          label={t("statRevenue")}
          value={formatCurrency(stats.totalRevenueCents)}
          sub={t("bookings", { count: stats.bookingCount })}
        />
      </div>

      {stats.pendingApplicationCount > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 flex items-center justify-between mb-6">
          <div>
            <div className="font-semibold text-yellow-800">
              {t("pendingAlertTitle", { count: stats.pendingApplicationCount })}
            </div>
            <div className="text-sm text-yellow-700">
              {t("pendingAlertBody")}
            </div>
          </div>
          <Link
            href="/admin/applications"
            className="px-4 py-2 rounded bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-700"
          >
            {t("reviewNow")}
          </Link>
        </div>
      )}
    </div>
  );
}
