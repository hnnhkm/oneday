"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { approveInstructorAction } from "@/lib/actions/instructor";

interface Props {
  profileId: string;
  name: string;
  email: string;
  bio: string;
  specialties: string[];
}

export function AdminApprovalRow({
  profileId,
  name,
  email,
  bio,
  specialties,
}: Props) {
  const t = useTranslations("admin.applications");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (decision: "approved" | "rejected") => {
    setError(null);
    startTransition(async () => {
      const r = await approveInstructorAction(
        profileId,
        decision,
        decision === "rejected" ? reason : undefined
      );
      if (!r.ok) {
        setError(r.error || "error");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg bg-white shadow-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-semibold text-charcoal">{name}</div>
          <div className="text-xs text-charcoal-lighter">{email}</div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => run("approved")}
            disabled={pending}
          >
            {t("approve")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowReject((v) => !v)}
            disabled={pending}
          >
            {t("reject")}
          </Button>
        </div>
      </div>
      <div className="text-sm text-charcoal mb-2 whitespace-pre-wrap">
        {bio}
      </div>
      <div className="flex flex-wrap gap-2">
        {specialties.map((s) => (
          <span
            key={s}
            className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600"
          >
            {s}
          </span>
        ))}
      </div>
      {showReject && (
        <div className="mt-3 pt-3 border-t border-charcoal-lighter/10">
          <label className="block text-xs text-charcoal-lighter mb-1">
            {t("reasonLabel")}
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-charcoal-lighter/30 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReject(false)}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => run("rejected")}
              disabled={pending}
              className="bg-red-500 hover:bg-red-600 active:bg-red-700"
            >
              {t("reject")}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
