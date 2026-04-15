"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CancelActivityDialog } from "./cancel-activity-dialog";

export function CancelRosterButton({ activityId }: { activityId: string }) {
  const t = useTranslations("instructor.activitiesList");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-red-600 border-red-200 hover:bg-red-50"
      >
        {t("actionCancel")}
      </Button>
      <CancelActivityDialog
        activityId={activityId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
