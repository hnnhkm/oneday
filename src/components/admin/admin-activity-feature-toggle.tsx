"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setActivityFeaturedOnHomeAction } from "@/lib/actions/admin";

interface Props {
  activityId: string;
  title: string;
  initialFeatured: boolean;
}

/**
 * Per-row toggle in the admin activities table for flipping an
 * activity's homepage "Atividades em destaque" visibility. Mirrors
 * AdminCategoryRow's optimistic-with-rollback pattern so the admin
 * gets instant feedback but UI state stays honest if the action fails.
 */
export function AdminActivityFeatureToggle({
  activityId,
  title,
  initialFeatured,
}: Props) {
  const t = useTranslations("admin.activities");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState(initialFeatured);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    setError(null);
    startTransition(async () => {
      const r = await setActivityFeaturedOnHomeAction(activityId, next);
      if (!r.ok) {
        setChecked(!next);
        setError(r.error || t("featureError"));
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        disabled={pending}
        className={`h-5 w-5 rounded border-charcoal-lighter/30 text-primary-400 focus:ring-primary-400 cursor-pointer ${
          pending ? "opacity-60" : ""
        }`}
        aria-label={t("featureToggleLabel", { title })}
        title={error ?? undefined}
      />
    </div>
  );
}
