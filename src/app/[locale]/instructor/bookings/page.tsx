import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireApprovedInstructor } from "@/lib/supabase/require-approved-instructor";
import { fetchAllInstructorBookings } from "@/lib/queries/instructor";
import { BookingCalendar } from "@/components/instructor/booking-calendar";
import {
  formatCurrency,
  formatDate,
  formatTime,
  getTranslatedField,
  cn,
} from "@/lib/utils";
import type { TranslatedField } from "@/lib/types/database";

type Tab = "all" | "upcoming" | "past" | "cancelled";
const TABS: Tab[] = ["all", "upcoming", "past", "cancelled"];

interface Props {
  searchParams: Promise<{ tab?: string; month?: string; date?: string }>;
}

export default async function InstructorBookingsPage({ searchParams }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("instructor.bookings");
  const tRoster = await getTranslations("instructor.roster");
  const { profile } = await requireApprovedInstructor();
  const params = await searchParams;
  const activeTab: Tab = (TABS as string[]).includes(params.tab || "")
    ? (params.tab as Tab)
    : "all";

  const all = await fetchAllInstructorBookings(profile.id);
  const today = new Date().toISOString().slice(0, 10);

  // Calendar month: parse from ?month=YYYY-MM or default to current
  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth(); // 0-indexed
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    calYear = y;
    calMonth = m - 1;
  }

  // Calendar data: flatten bookings to the shape the calendar needs
  const calendarBookings = all.map((b) => ({
    activityDate: b.activities.date,
    status: b.status as "confirmed" | "cancelled" | "completed",
  }));

  // If a specific date is selected via the calendar, filter the list
  const selectedDate = params.date || undefined;

  const visible = all.filter((b) => {
    // Date filter from calendar click takes priority
    if (selectedDate && b.activities.date !== selectedDate) return false;

    if (activeTab === "all") return true;
    if (activeTab === "cancelled") return b.status === "cancelled";
    if (b.status === "cancelled") return false;
    const isPast = b.activities.date < today;
    if (activeTab === "past") return isPast;
    return !isPast;
  });

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
        {t("title")}
      </h1>

      <BookingCalendar
        bookings={calendarBookings}
        year={calYear}
        month={calMonth}
        locale={locale}
        selectedDate={selectedDate}
      />

      {selectedDate && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-charcoal-lighter">
            {t("filteringByDate", { date: formatDate(selectedDate, locale) })}
          </span>
          <Link
            href={`/instructor/bookings?month=${calYear}-${String(calMonth + 1).padStart(2, "0")}` as "/instructor/bookings"}
            className="text-primary-400 hover:underline"
          >
            {t("clearDateFilter")}
          </Link>
        </div>
      )}

      <div className="flex gap-2 border-b border-charcoal-lighter/10 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={
              `/instructor/bookings?tab=${tab}` as "/instructor/bookings"
            }
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              activeTab === tab
                ? "border-primary-400 text-primary-400"
                : "border-transparent text-charcoal-lighter hover:text-charcoal"
            )}
          >
            {t(
              ("tab" + tab.charAt(0).toUpperCase() + tab.slice(1)) as
                | "tabAll"
                | "tabUpcoming"
                | "tabPast"
                | "tabCancelled"
            )}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 text-charcoal-lighter">
          {t("empty")}
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-charcoal-lighter border-b border-charcoal-lighter/10">
              <tr>
                <th className="text-left px-4 py-3">{tRoster("bookedBy")}</th>
                <th className="text-left px-4 py-3">{t("activityCol")}</th>
                <th className="text-left px-4 py-3">
                  {tRoster("seatsBookedCol")}
                </th>
                <th className="text-left px-4 py-3">{tRoster("totalPaid")}</th>
                <th className="text-left px-4 py-3">{tRoster("statusCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-lighter/10">
              {visible.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-medium text-charcoal">
                    {b.users.name}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={
                        `/instructor/activities/${b.activities.id}` as "/instructor/activities"
                      }
                      className="text-primary-400 hover:underline"
                    >
                      {getTranslatedField(
                        b.activities.title as TranslatedField,
                        locale
                      )}
                    </Link>
                    <div className="text-xs text-charcoal-lighter">
                      {formatDate(b.activities.date, locale)} ·{" "}
                      {formatTime(b.activities.time)}
                    </div>
                  </td>
                  <td className="px-4 py-3">{b.seats_booked}</td>
                  <td className="px-4 py-3">
                    {formatCurrency(b.total_price_cents)}
                  </td>
                  <td className="px-4 py-3 capitalize">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
