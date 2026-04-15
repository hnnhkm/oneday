"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/lib/actions/notifications";

export function MarkAllReadButton({ unread }: { unread: number }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (unread === 0) return null;

  const onClick = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
    >
      {t("markAllAsRead")}
    </Button>
  );
}
