"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { demoteInstructorAction } from "@/lib/actions/admin";

export function RevokeInstructorButton({ userId }: { userId: string }) {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const r = await demoteInstructorAction(userId);
      if (!r.ok) {
        setError(r.error || "error");
        return;
      }
      setOpen(false);
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
        {t("revoke")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg shadow-card max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-charcoal mb-2">
              {t("revokeTitle")}
            </h3>
            <p className="text-sm text-charcoal-lighter mb-4">
              {t("revokeBody")}
            </p>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={onConfirm}
                disabled={pending}
                className="bg-red-500 hover:bg-red-600 active:bg-red-700"
              >
                {pending ? t("revokePending") : t("revokeConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
