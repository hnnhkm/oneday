"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setCategoryHomeVisibilityAction } from "@/lib/actions/admin";

interface Props {
  categoryId: string;
  icon: string;
  name: string;
  slug: string;
  initialShowOnHome: boolean;
}

/**
 * Single-category row on the admin curation page. Optimistically flips
 * the toggle client-side so the admin sees instant feedback, then
 * reconciles against the server action. On error we roll back the
 * local state and surface the message inline.
 */
export function AdminCategoryRow({
  categoryId,
  icon,
  name,
  slug,
  initialShowOnHome,
}: Props) {
  const t = useTranslations("admin.categories");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState(initialShowOnHome);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    setError(null);
    startTransition(async () => {
      const r = await setCategoryHomeVisibilityAction(categoryId, next);
      if (!r.ok) {
        // Roll back so the UI reflects the true server state.
        setChecked(!next);
        setError(r.error || t("error"));
        return;
      }
      router.refresh();
    });
  };

  return (
    <label
      className={`flex items-center gap-3 rounded-lg bg-white shadow-card px-4 py-3 cursor-pointer transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-charcoal">{name}</div>
        <div className="text-xs text-charcoal-lighter">{slug}</div>
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </div>
      {/* Native checkbox — simpler than a custom switch and keyboard-
          accessible out of the box. `onChange` fires after the state
          change so we can read the new value directly. */}
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        disabled={pending}
        className="h-5 w-5 rounded border-charcoal-lighter/30 text-primary-400 focus:ring-primary-400 cursor-pointer"
        aria-label={t("toggleLabel", { name })}
      />
    </label>
  );
}
