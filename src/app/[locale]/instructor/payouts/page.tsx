import { getTranslations, getLocale } from "next-intl/server";
import { requireApprovedInstructor } from "@/lib/supabase/require-approved-instructor";
import { isStripeEnabled } from "@/lib/stripe-config";
import {
  fetchStripeAccountStatus,
  fetchStripeTransfers,
  type StripeAccountStatus,
  type StripeTransferRow,
} from "@/lib/queries/stripe-connect";
import { fetchInstructorBookingsForEarnings } from "@/lib/queries/instructor";
import { computeInstructorEarnings } from "@/lib/instructor-earnings";
import { ConnectStripeButton } from "@/components/instructor/connect-stripe-button";
import { EarningsSummaryCard } from "@/components/instructor/earnings-summary-card";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

/**
 * Three-tier rendering:
 *
 *   1. Stripe disabled (no STRIPE_SECRET_KEY)
 *      → "Stripe não configurado" empty state, same tone as the
 *        dry-run email log: the code path works, the operator just
 *        hasn't wired the key yet.
 *
 *   2. Stripe enabled, profile has no stripe_account_id
 *      → Explain what Connect does + "Conectar ao Stripe" button
 *        that kicks off the onboarding redirect.
 *
 *   3. Stripe enabled, profile has an account id
 *      → Status card (charges_enabled, payouts_enabled, details
 *        submitted, currently-due requirements) + transfer history
 *        pulled live from stripe.transfers.list.
 */
export default async function InstructorPayoutsPage() {
  const locale = await getLocale();
  const t = await getTranslations("instructor.payouts");
  const { profile } = await requireApprovedInstructor();

  // Earnings summary is independent of Stripe state — it's computed
  // from bookings, not from Stripe transfers. Render it in all three
  // tiers so instructors always see the same "what have I earned"
  // story regardless of onboarding progress.
  const today = new Date().toISOString().slice(0, 10);
  const bookings = await fetchInstructorBookingsForEarnings(profile.id);
  const earnings = computeInstructorEarnings(
    bookings,
    profile.commission_rate,
    today
  );

  if (!isStripeEnabled()) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
          {t("title")}
        </h1>
        <EarningsSummaryCard earnings={earnings} />
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
          {t("stripeNotConfigured")}
        </div>
      </div>
    );
  }

  if (!profile.stripe_account_id) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
          {t("title")}
        </h1>
        <EarningsSummaryCard earnings={earnings} />
        <div className="rounded-lg bg-white shadow-card p-6">
          <div className="text-5xl mb-3" aria-hidden>
            💳
          </div>
          <h2 className="text-lg font-semibold text-charcoal mb-2">
            {t("onboardTitle")}
          </h2>
          <p className="text-sm text-charcoal-lighter mb-4">
            {t("onboardBody")}
          </p>
          <ConnectStripeButton />
        </div>
      </div>
    );
  }

  const [status, transfers] = await Promise.all([
    fetchStripeAccountStatus(profile.stripe_account_id),
    fetchStripeTransfers(profile.stripe_account_id, 20),
  ]);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
        {t("title")}
      </h1>

      <EarningsSummaryCard earnings={earnings} />

      {status ? (
        <StatusCard status={status} t={t} />
      ) : (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-6">
          {t("statusFetchError")}
        </div>
      )}

      <h2 className="text-lg font-semibold text-charcoal mt-8 mb-3">
        {t("historyTitle")}
      </h2>
      <TransferHistory transfers={transfers} locale={locale} t={t} />
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;

function StatusCard({ status, t }: { status: StripeAccountStatus; t: T }) {
  return (
    <div className="rounded-lg bg-white shadow-card p-6 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <StatusRow
          label={t("chargesEnabled")}
          ok={status.chargesEnabled}
        />
        <StatusRow
          label={t("payoutsEnabled")}
          ok={status.payoutsEnabled}
        />
        <StatusRow
          label={t("detailsSubmitted")}
          ok={status.detailsSubmitted}
        />
      </div>
      {status.requirementsCurrentlyDue.length > 0 && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800">
          <div className="font-medium mb-1">
            {t("pendingRequirements")}
          </div>
          <ul className="list-disc pl-4">
            {status.requirementsCurrentlyDue.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex-1 text-center">
      <div
        className={cn(
          "text-2xl mb-1",
          ok ? "text-secondary-500" : "text-charcoal-lighter"
        )}
        aria-hidden
      >
        {ok ? "✓" : "○"}
      </div>
      <div className="text-xs text-charcoal-lighter">{label}</div>
    </div>
  );
}

function TransferHistory({
  transfers,
  locale,
  t,
}: {
  transfers: StripeTransferRow[];
  locale: string;
  t: T;
}) {
  if (transfers.length === 0) {
    return (
      <div className="rounded-lg bg-white shadow-card p-8 text-center text-charcoal-lighter">
        {t("historyEmpty")}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white shadow-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-charcoal-lighter border-b border-charcoal-lighter/10">
          <tr>
            <th className="text-left px-4 py-3">{t("periodCol")}</th>
            <th className="text-left px-4 py-3">{t("amountCol")}</th>
            <th className="text-left px-4 py-3">{t("statusCol")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-lighter/10">
          {transfers.map((tr) => (
            <tr key={tr.id}>
              <td className="px-4 py-3 text-charcoal-lighter">
                {formatDate(tr.createdAt.slice(0, 10), locale)}
              </td>
              <td className="px-4 py-3 font-medium text-charcoal">
                {formatCurrency(tr.amountCents)}
              </td>
              <td className="px-4 py-3 text-xs text-charcoal-lighter">
                {tr.description || tr.id.slice(0, 12)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
