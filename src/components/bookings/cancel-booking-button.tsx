"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cancelBookingAction } from "@/lib/actions/account";
import {
  computeRefundCents,
  hoursUntilStart,
} from "@/lib/refund-policy";
import { formatCurrency } from "@/lib/utils";
import type { CancellationPolicy } from "@/lib/types/database";

interface CancelBookingButtonProps {
  bookingId: string;
  activityDate: string;
  activityTime: string;
  totalPriceCents: number;
  cancellationPolicy: CancellationPolicy;
}

export function CancelBookingButton({
  bookingId,
  activityDate,
  activityTime,
  totalPriceCents,
  cancellationPolicy,
}: CancelBookingButtonProps) {
  const t = useTranslations("bookings");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Compute the preview refund with the same pure helper the server
  // action uses, so the UI number matches the actual refund within
  // seconds (network drift only).
  const hours = hoursUntilStart(activityDate, activityTime);
  const refundCents = computeRefundCents({
    policy: cancellationPolicy,
    hoursUntilStart: hours,
    totalPriceCents,
  });
  const refundPercent = Math.round((refundCents / totalPriceCents) * 100);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelBookingAction(bookingId);
      if (!result.ok) {
        setError(result.error || t("cancelError"));
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const policyKey: "flexible" | "moderate" | "strict" = cancellationPolicy;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isPending ? t("cancelling") : t("cancelBooking")}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg shadow-card max-w-md w-full mx-4 p-6 text-left">
            <h3 className="text-lg font-semibold text-charcoal mb-2">
              {t("cancelConfirmTitle")}
            </h3>
            <p className="text-sm text-charcoal-lighter mb-3">
              {t("cancelConfirmBody")}
            </p>

            <div className="rounded-md bg-background-muted p-3 mb-4 text-sm">
              <div className="flex justify-between text-charcoal-lighter mb-1">
                <span>{t("totalPaid")}</span>
                <span>{formatCurrency(totalPriceCents)}</span>
              </div>
              <div className="flex justify-between font-semibold text-charcoal">
                <span>
                  {t("refundAmount")} ({refundPercent}%)
                </span>
                <span
                  className={
                    refundCents > 0 ? "text-secondary-700" : "text-red-600"
                  }
                >
                  {formatCurrency(refundCents)}
                </span>
              </div>
              <p className="text-xs text-charcoal-lighter mt-2">
                {t(`policyExplainer.${policyKey}`)}
              </p>
            </div>

            {error && (
              <p className="mb-3 text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                {t("keepBooking")}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isPending}
                className="bg-red-500 hover:bg-red-600 active:bg-red-700"
              >
                {isPending ? t("cancelling") : t("confirmCancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
