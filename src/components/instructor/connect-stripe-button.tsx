"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { startInstructorOnboardingAction } from "@/lib/actions/stripe-connect";

export function ConnectStripeButton() {
  const t = useTranslations("instructor.payouts");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await startInstructorOnboardingAction();
      if (!r.ok || !r.url) {
        setError(r.error || t("connectError"));
        return;
      }
      // External redirect to Stripe's hosted onboarding page.
      window.location.href = r.url;
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={handleClick} disabled={pending}>
        {pending ? t("connecting") : t("connect")}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
