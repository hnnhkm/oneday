"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toggleEmailPreferenceAction } from "@/lib/actions/notification-preferences";
import type { NotificationType } from "@/lib/types/database";

/** The notification types a regular user cares about. Instructor-
 *  and admin-specific types are only relevant if the user has
 *  those roles, but showing them doesn't hurt — the dispatcher
 *  simply won't generate notifications the user can't receive. */
const USER_TYPES: NotificationType[] = [
  "booking_confirmed",
  "booking_cancelled",
  "activity_reminder",
  "review_prompt",
  "saved_search_matched",
];

const INSTRUCTOR_TYPES: NotificationType[] = [
  "instructor_approved",
  "instructor_rejected",
  "payout_sent",
  "activity_flagged",
];

interface Props {
  preferences: Map<NotificationType, boolean>;
  isInstructor: boolean;
}

export function NotificationPreferencesForm({
  preferences,
  isInstructor,
}: Props) {
  const t = useTranslations("notificationPreferences");

  const types = isInstructor
    ? [...USER_TYPES, ...INSTRUCTOR_TYPES]
    : USER_TYPES;

  return (
    <div className="space-y-3">
      {types.map((type) => (
        <ToggleRow
          key={type}
          type={type}
          label={t(type)}
          enabled={preferences.get(type) !== false}
        />
      ))}
    </div>
  );
}

function ToggleRow({
  type,
  label,
  enabled,
}: {
  type: NotificationType;
  label: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleEmailPreferenceAction(type, !enabled);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg bg-white shadow-card p-4">
      <span className="text-sm text-charcoal">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-primary-400" : "bg-charcoal-lighter/30"
        } ${isPending ? "opacity-50" : ""}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
