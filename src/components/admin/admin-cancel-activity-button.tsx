"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { adminCancelActivityAction } from "@/lib/actions/admin";

export function AdminCancelActivityButton({
  activityId,
}: {
  activityId: string;
}) {
  const t = useTranslations("admin.activities");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const r = await adminCancelActivityAction(activityId, reason);
      if (!r.ok) {
        setError(r.error || t("cancelError"));
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {t("cancelAction")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg shadow-card max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-charcoal mb-2">
              {t("cancelTitle")}
            </h3>
            <p className="text-sm text-charcoal-lighter mb-3">
              {t("cancelBody")}
            </p>

            <label className="block text-xs text-charcoal-lighter mb-1">
              {t("reasonLabel")}
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              maxLength={500}
              className="w-full rounded border border-charcoal-lighter/30 bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                {t("keep")}
              </Button>
              <Button
                onClick={onConfirm}
                disabled={pending}
                className="bg-red-500 hover:bg-red-600 active:bg-red-700"
              >
                {pending ? t("cancelPending") : t("cancelConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
