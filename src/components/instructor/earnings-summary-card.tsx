import { getTranslations } from "next-intl/server";
import { StatCard } from "@/components/instructor/stat-card";
import { formatCurrency } from "@/lib/utils";
import type { InstructorEarnings } from "@/lib/instructor-earnings";

/**
 * Three-card summary rendered above the Stripe Connect status card
 * on /instructor/payouts. Uses computeInstructorEarnings under the
 * hood (delegated at the page level) so this component is purely
 * presentational.
 *
 * The distinction between "Pendente" and "Recebido" matches the
 * user mental model: seats sold for future dates are money *owed*,
 * not money *held*. Stripe's own payout cycle is independent of
 * this view — that section lives below.
 */
export async function EarningsSummaryCard({
  earnings,
}: {
  earnings: InstructorEarnings;
}) {
  const t = await getTranslations("instructor.payouts.earnings");

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-charcoal-lighter mb-3">
        {t("sectionTitle")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon="⏳"
          label={t("upcomingLabel")}
          value={formatCurrency(earnings.upcomingNetCents)}
          sub={t("bookingCount", { count: earnings.upcomingCount })}
        />
        <StatCard
          icon="📅"
          label={t("thisMonthLabel")}
          value={formatCurrency(earnings.thisMonthNetCents)}
          sub={t("bookingCount", { count: earnings.thisMonthCount })}
        />
        <StatCard
          icon="💰"
          label={t("allTimeLabel")}
          value={formatCurrency(earnings.allTimeNetCents)}
          sub={t("bookingCount", { count: earnings.allTimeCount })}
        />
      </div>
      <p className="text-xs text-charcoal-lighter mt-2">
        {t("footnote")}
      </p>
    </div>
  );
}
