"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cancelActivityAction } from "@/lib/actions/instructor";

interface Props {
  activityId: string;
  open: boolean;
  onClose: () => void;
}

export function CancelActivityDialog({ activityId, open, onClose }: Props) {
  const t = useTranslations("instructor.cancel");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const r = await cancelActivityAction(activityId, reason);
      if (!r.ok) {
        setError(r.error || t("errorGeneric"));
        return;
      }
      setReason("");
      onClose();
      router.refresh();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-card max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-charcoal mb-2">
          {t("title")}
        </h3>
        <p className="text-sm text-charcoal-lighter mb-4">{t("body")}</p>

        <label
          htmlFor="cancel-reason"
          className="block text-xs text-charcoal-lighter mb-1"
        >
          {t("reasonLabel")}
        </label>
        <textarea
          id="cancel-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
          maxLength={500}
          className="w-full rounded border border-charcoal-lighter/30 bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />

        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t("keep")}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className="bg-red-500 hover:bg-red-600 active:bg-red-700"
          >
            {pending ? t("cancelling") : t("confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
