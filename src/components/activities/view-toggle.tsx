"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "map" | "calendar";

// Calendar view hidden — the date range filter covers the same use case.
// To re-enable, add "calendar" back to this array.
const MODES: ViewMode[] = ["list", "map"];
const LABEL_KEYS: Record<ViewMode, string> = {
  list: "viewList",
  map: "viewMap",
  calendar: "viewCalendar",
};

/**
 * Toggle buttons for switching between list, map, and calendar
 * views on the activities browse page. Uses URL params so the
 * view mode is shareable/bookmarkable.
 */
export function ViewToggle() {
  const t = useTranslations("activities");
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const raw = searchParams.get("view");
  const current: ViewMode =
    raw === "map" ? "map" : raw === "calendar" ? "calendar" : "list";

  function buildHref(view: ViewMode): string {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "list") {
      params.delete("view");
      params.delete("calMonth");
    } else {
      params.set("view", view);
    }
    if (view !== "calendar") {
      params.delete("calMonth");
    }
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex rounded-md border border-charcoal-lighter/20 overflow-hidden">
      {MODES.map((mode, i) => (
        <Link
          key={mode}
          href={buildHref(mode) as "/activities"}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors",
            i > 0 && "border-l border-charcoal-lighter/20",
            current === mode
              ? "bg-primary-400 text-white"
              : "bg-white text-charcoal hover:bg-background-muted"
          )}
        >
          {t(LABEL_KEYS[mode])}
        </Link>
      ))}
    </div>
  );
}
