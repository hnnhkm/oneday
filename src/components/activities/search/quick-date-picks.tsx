"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface QuickDatePicksProps {
  /**
   * Current `dateFrom` from the parent. Used to highlight whichever
   * pick matches. Empty string means no date filter is active, which
   * highlights the "Any date" pick.
   */
  selected: string | null;
  /**
   * Called with `(from, to, label)`. To clear the filter entirely
   * (the "Any date" pick) this is invoked with two empty strings —
   * the parent treats that as "no date constraint".
   */
  onSelect: (dateFrom: string, dateTo: string, label: string) => void;
}

function formatISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function QuickDatePicks({ selected, onSelect }: QuickDatePicksProps) {
  const t = useTranslations("activities");

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayOfWeek = today.getDay();
  const friday = new Date(today);
  friday.setDate(today.getDate() + ((5 - dayOfWeek + 7) % 7));
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  // `Any date` is represented by two empty strings — the parent
  // clears dateFrom/dateTo and no date constraint is applied to the
  // query. It also doesn't have a date caption since it means "no
  // date", so `sub` is intentionally null.
  const picks: Array<{
    label: string;
    sub: string | null;
    from: string;
    to: string;
  }> = [
    { label: t("anytime"), sub: null, from: "", to: "" },
    { label: t("today"), sub: today.toLocaleDateString("en", { month: "short", day: "numeric" }), from: formatISO(today), to: formatISO(today) },
    { label: t("tomorrow"), sub: tomorrow.toLocaleDateString("en", { month: "short", day: "numeric" }), from: formatISO(tomorrow), to: formatISO(tomorrow) },
    { label: t("thisWeekend"), sub: `${friday.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en", { month: "short", day: "numeric" })}`, from: formatISO(friday), to: formatISO(sunday) },
  ];

  // Normalize the incoming `selected` prop so we can compare against
  // each pick's `from`. `null` comes from parents that distinguish
  // "no selection" from empty-string; either way it maps to the
  // "Any date" pick.
  const selectedFrom = selected ?? "";

  return (
    <div className="flex gap-2 flex-wrap">
      {picks.map((pick) => (
        <button
          key={pick.label}
          type="button"
          onClick={() => onSelect(pick.from, pick.to, pick.label)}
          className={cn(
            "flex-1 min-w-[6rem] rounded-xl border px-3 py-3 text-left transition-colors",
            selectedFrom === pick.from
              ? "border-charcoal bg-charcoal/5"
              : "border-charcoal-lighter/20 hover:border-charcoal-lighter/50"
          )}
        >
          <div className="text-sm font-semibold text-charcoal">{pick.label}</div>
          {pick.sub && (
            <div className="text-xs text-charcoal-lighter mt-0.5">{pick.sub}</div>
          )}
        </button>
      ))}
    </div>
  );
}
