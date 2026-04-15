"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  confirmSessionQuorumAction,
  cancelSessionAction,
} from "@/lib/actions/sessions";

export interface AtRiskSession {
  sessionId: string;
  activityTitle: string;
  startsAt: string;
  booked: number;
  minParticipants: number;
}

/**
 * Surfaces sessions in `quorum_state = 'at_risk'` on the instructor
 * dashboard. Two actions per row: Confirm (proceeds with however many
 * signed up) or Cancel (full refunds to everyone). The card itself
 * is client-side so the actions can update the list optimistically;
 * the parent page does the server-side fetch and passes initial data.
 */
export function AtRiskSessionsCard({
  initialSessions,
}: {
  initialSessions: AtRiskSession[];
}) {
  const t = useTranslations("instructor");
  const locale = useLocale() as "pt" | "en" | "es";
  const [sessions, setSessions] = useState(initialSessions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (sessions.length === 0) return null;

  function handleConfirm(sessionId: string) {
    setPendingId(sessionId);
    startTransition(async () => {
      const res = await confirmSessionQuorumAction(sessionId);
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      } else {
        console.error(
          `[at-risk-sessions-card] confirmSessionQuorumAction failed: ${res.error}`
        );
      }
      setPendingId(null);
    });
  }

  function handleCancel(sessionId: string) {
    if (!confirm(t("atRiskConfirmCancel"))) return;
    setPendingId(sessionId);
    startTransition(async () => {
      const res = await cancelSessionAction(sessionId);
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      } else {
        console.error(
          `[at-risk-sessions-card] cancelSessionAction failed: ${res.error}`
        );
      }
      setPendingId(null);
    });
  }

  return (
    <div className="rounded-lg border border-accent-300 bg-accent-50 p-5">
      <h2 className="text-lg font-semibold text-charcoal mb-3">
        <span aria-hidden="true">⚠</span> {t("atRiskCardTitle", { count: sessions.length })}
      </h2>
      <ul className="space-y-3">
        {sessions.map((s) => (
          <li
            key={s.sessionId}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md bg-white p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-charcoal truncate">
                {s.activityTitle}
              </p>
              <p className="text-xs text-charcoal-lighter">
                {formatSessionDate(s.startsAt, locale)} ·{" "}
                {t("atRiskParticipants", {
                  booked: s.booked,
                  min: s.minParticipants,
                })}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                disabled={isPending && pendingId === s.sessionId}
                onClick={() => handleConfirm(s.sessionId)}
              >
                {t("atRiskConfirm")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending && pendingId === s.sessionId}
                onClick={() => handleCancel(s.sessionId)}
              >
                {t("atRiskCancel")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatSessionDate(iso: string, locale: "pt" | "en" | "es"): string {
  const localeMap = { pt: "pt-BR", en: "en-US", es: "es-ES" } as const;
  const d = new Date(iso);
  const date = d.toLocaleDateString(localeMap[locale], {
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
  const time = d.toLocaleTimeString(localeMap[locale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${date} · ${time}`;
}
