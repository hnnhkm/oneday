import { Link } from "@/i18n/navigation";

interface WeeklyDateStripProps {
  locale: string;
  title: string;
  seeAllLabel: string;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoDate(date: Date): string {
  // YYYY-MM-DD in local time
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function WeeklyDateStrip({ locale, title, seeAllLabel }: WeeklyDateStripProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });

  return (
    <section className="py-12 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-2xl font-bold text-charcoal mb-6 text-center">
          {title}
        </h2>
        {/* Seven day cards + a trailing "see all" slot, mirroring the
            dashed-border pattern used by CategoryGrid / FeaturedActivities.
            8-column grid so the see-all card claims the eighth cell. */}
        <div className="grid grid-cols-8 gap-2 sm:gap-3">
          {days.map((date, i) => {
            const iso = toIsoDate(date);
            const weekday = weekdayFmt.format(date).replace(".", "");
            const month = monthFmt.format(date).replace(".", "");
            const dayNum = date.getDate();
            const isToday = i === 0;

            return (
              <Link
                key={iso}
                href={`/activities?dateFrom=${iso}&dateTo=${iso}`}
                className={`flex flex-col items-center justify-center py-3 sm:py-4 rounded-xl border-2 transition-all hover:border-primary-400 hover:shadow-card ${
                  isToday
                    ? "border-primary-400 bg-primary-50"
                    : "border-charcoal-lighter/10 bg-white"
                }`}
              >
                <span className="text-xs font-medium text-charcoal-lighter uppercase">
                  {weekday}
                </span>
                <span className="text-2xl font-bold text-charcoal mt-1">
                  {dayNum}
                </span>
                <span className="text-xs text-charcoal-lighter mt-0.5">
                  {month}
                </span>
              </Link>
            );
          })}
          {/* "See all" slot — dashed border + arrow, matching the
              category-grid pattern. Height is driven by the sibling
              date cards' content so it lines up automatically. */}
          <Link
            href="/activities"
            className="flex flex-col items-center justify-center gap-1 py-3 sm:py-4 rounded-xl border-2 border-dashed border-charcoal-lighter/20 hover:border-primary-400 transition-colors text-center group"
          >
            <span className="text-2xl font-bold text-charcoal-lighter group-hover:text-primary-400 transition-colors">
              →
            </span>
            <span className="text-xs font-medium text-charcoal-lighter group-hover:text-primary-400 transition-colors">
              {seeAllLabel}
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
