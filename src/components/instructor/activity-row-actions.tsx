"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  deleteActivityAction,
  duplicateActivityAction,
  publishActivityAction,
  unpublishActivityAction,
} from "@/lib/actions/instructor";
import { canCancelActivity } from "@/lib/activity-validation";
import { CancelActivityDialog } from "./cancel-activity-dialog";

interface Props {
  activityId: string;
  status: "draft" | "published" | "cancelled" | "completed";
  date: string;
  today: string;
  bookingCount: number;
}

export function ActivityRowActions({
  activityId,
  status,
  date,
  today,
  bookingCount,
}: Props) {
  const t = useTranslations("instructor.activitiesList");
  const td = useTranslations("instructor.delete");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cancellable = canCancelActivity({ status, date, today });

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const onDuplicate = () => {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const r = await duplicateActivityAction(activityId);
      if (r.ok && r.newActivityId) {
        router.push(
          `/instructor/activities/${r.newActivityId}/edit` as "/instructor/activities"
        );
      } else {
        setError(r.error || "error");
      }
    });
  };

  const onPublish = () => {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const r = await publishActivityAction(activityId);
      if (!r.ok) setError(r.error || "error");
      else router.refresh();
    });
  };

  const onUnpublish = () => {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const r = await unpublishActivityAction(activityId);
      if (!r.ok) setError(r.error || "error");
      else router.refresh();
    });
  };

  const onDelete = () => {
    setError(null);
    startTransition(async () => {
      const r = await deleteActivityAction(activityId);
      if (!r.ok) setError(r.error || "error");
      else {
        setConfirmDelete(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={pending}
          className="p-2 rounded-md text-charcoal-lighter hover:bg-background-muted hover:text-charcoal transition-colors"
          aria-label="Actions"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-lg shadow-dropdown py-1 min-w-[180px]">
            <Link
              href={`/instructor/activities/${activityId}/edit` as "/instructor/activities"}
              className="block px-4 py-2 text-sm text-charcoal hover:bg-background-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              {t("actionEdit")}
            </Link>
            <Link
              href={`/instructor/activities/${activityId}` as "/instructor/activities"}
              className="block px-4 py-2 text-sm text-charcoal hover:bg-background-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              {t("actionRoster")}
            </Link>
            <button
              type="button"
              onClick={onDuplicate}
              disabled={pending}
              className="w-full text-left px-4 py-2 text-sm text-charcoal hover:bg-background-muted transition-colors disabled:opacity-50"
            >
              {t("actionDuplicate")}
            </button>
            {status === "draft" && (
              <button
                type="button"
                onClick={onPublish}
                disabled={pending}
                className="w-full text-left px-4 py-2 text-sm text-charcoal hover:bg-background-muted transition-colors disabled:opacity-50"
              >
                {t("actionPublish")}
              </button>
            )}
            {status === "published" && (
              <button
                type="button"
                onClick={onUnpublish}
                disabled={pending}
                className="w-full text-left px-4 py-2 text-sm text-charcoal hover:bg-background-muted transition-colors disabled:opacity-50"
              >
                {t("actionUnpublish")}
              </button>
            )}
            <div className="border-t border-charcoal-lighter/10 my-1" />
            {cancellable && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmCancel(true);
                }}
                disabled={pending}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {t("actionCancel")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmDelete(true);
              }}
              disabled={pending}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {t("actionDelete")}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}

      <CancelActivityDialog
        activityId={activityId}
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
      />

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg shadow-card max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-charcoal mb-2">
              {td("title")}
            </h3>
            <p className="text-sm text-charcoal-lighter mb-4">
              {bookingCount > 0
                ? td("bodyHasBookings", { count: bookingCount })
                : td("body")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
              >
                {td("cancel")}
              </Button>
              <Button
                onClick={onDelete}
                disabled={pending || bookingCount > 0}
                className="bg-red-500 hover:bg-red-600 active:bg-red-700"
              >
                {td("confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
