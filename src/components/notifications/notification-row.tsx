"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { markNotificationReadAction } from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types/database";

interface Props {
  notification: Notification;
  dateLabel: string;
}

const TYPE_ICON: Record<string, string> = {
  booking_confirmed: "✅",
  booking_cancelled: "❌",
  activity_reminder: "⏰",
  review_prompt: "⭐",
  instructor_approved: "🎉",
  instructor_rejected: "😞",
  no_show_charged: "⚠️",
  payout_sent: "💰",
  activity_flagged: "🚩",
};

export function NotificationRow({ notification, dateLabel }: Props) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const icon = TYPE_ICON[notification.type] || "🔔";

  const handleMarkRead = () => {
    startTransition(async () => {
      await markNotificationReadAction(notification.id);
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        "p-4 flex items-start gap-3",
        !notification.read && "bg-primary-50/30"
      )}
    >
      <div
        aria-hidden
        className="w-10 h-10 rounded-full bg-background-muted flex items-center justify-center text-lg flex-shrink-0"
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium text-charcoal">{notification.title}</div>
          {!notification.read && (
            <span className="inline-block w-2 h-2 rounded-full bg-primary-400" />
          )}
        </div>
        <div className="text-sm text-charcoal-lighter mt-0.5">
          {notification.body}
        </div>
        <div className="text-xs text-charcoal-lighter mt-1">{dateLabel}</div>
      </div>
      {!notification.read && (
        <button
          type="button"
          onClick={handleMarkRead}
          disabled={pending}
          className="text-xs text-primary-400 hover:underline flex-shrink-0 disabled:opacity-50"
        >
          {t("markAsRead")}
        </button>
      )}
    </div>
  );
}
