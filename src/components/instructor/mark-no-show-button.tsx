"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { markNoShowAction } from "@/lib/actions/instructor";

interface Props {
  bookingId: string;
  /** Already flagged as no-show? Renders a read-only badge instead. */
  alreadyMarked: boolean;
  /** Computed by the server component via `canMarkNoShow`. */
  enabled: boolean;
}

export function MarkNoShowButton({
  bookingId,
  alreadyMarked,
  enabled,
}: Props) {
  const t = useTranslations("instructor.roster");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyMarked) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600">
        {t("noShowBadge")}
      </span>
    );
  }

  if (!enabled) return null;

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const r = await markNoShowAction(bookingId);
      if (!r.ok) {
        setError(r.error || t("noShowError"));
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {t("actionNoShow")}
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg shadow-card max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-charcoal mb-2">
              {t("noShowTitle")}
            </h3>
            <p className="text-sm text-charcoal-lighter mb-4">
              {t("noShowBody")}
            </p>
            {error && (
              <p className="mb-3 text-sm text-red-600">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                {t("noShowCancel")}
              </Button>
              <Button
                onClick={onConfirm}
                disabled={pending}
                className="bg-red-500 hover:bg-red-600 active:bg-red-700"
              >
                {pending ? t("noShowPending") : t("noShowConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
