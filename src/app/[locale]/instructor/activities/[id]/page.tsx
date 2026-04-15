import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { requireApprovedInstructor } from "@/lib/supabase/require-approved-instructor";
import {
  fetchMyActivityById,
  fetchActivityBookings,
  fetchActivitySessions,
} from "@/lib/queries/instructor";
import { canCancelActivity } from "@/lib/queries/activities";
import { canMarkNoShow } from "@/lib/queries/bookings";
import { CancelRosterButton } from "@/components/instructor/cancel-roster-button";
import { MarkNoShowButton } from "@/components/instructor/mark-no-show-button";
import { SessionsManager } from "@/components/instructor/sessions-manager";
import {
  formatCurrency,
  formatDate,
  formatTime,
  getTranslatedField,
} from "@/lib/utils";
import type { TranslatedField } from "@/lib/types/database";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ActivityRosterPage({ params }: Props) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("instructor.roster");
  const { profile } = await requireApprovedInstructor();

  const activity = await fetchMyActivityById(id, profile.id);
  if (!activity) notFound();

  const [bookings, sessions] = await Promise.all([
    fetchActivityBookings(id),
    fetchActivitySessions(id, profile.id),
  ]);
  const active = bookings.filter((b) => b.status !== "cancelled");
  const totalSeats = active.reduce((s, b) => s + b.seats_booked, 0);
  const revenue = active.reduce((s, b) => s + b.total_price_cents, 0);

  const today = new Date().toISOString().slice(0, 10);
  const isPast = activity.date < today;
  const cancellable = canCancelActivity({
    status: activity.status,
    date: activity.date,
    today,
  });

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="w-full md:w-64 aspect-[4/3] rounded-lg overflow-hidden bg-background-muted flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activity.cover_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-charcoal mb-2">
            {getTranslatedField(activity.title as TranslatedField, locale)}
          </h1>
          <p className="text-sm text-charcoal-lighter mb-1">
            📅 {formatDate(activity.date, locale)} ·{" "}
            {formatTime(activity.time)}
          </p>
          <p className="text-sm text-charcoal-lighter mb-4">
            📍 {activity.address}, {activity.neighborhood}
          </p>
          <div className="flex gap-6 mt-4">
            <div>
              <div className="text-xs text-charcoal-lighter">{t("seats")}</div>
              <div className="text-lg font-semibold text-charcoal">
                {totalSeats}/{activity.max_seats}
              </div>
            </div>
            <div>
              <div className="text-xs text-charcoal-lighter">
                {t("revenue")}
              </div>
              <div className="text-lg font-semibold text-charcoal">
                {formatCurrency(revenue)}
              </div>
            </div>
          </div>
          {cancellable && (
            <div className="mt-4">
              <CancelRosterButton activityId={activity.id} />
            </div>
          )}
        </div>
      </div>

      {/* Sessions manager: multi-session UI lives here now, just
          above the roster. The roster still aggregates bookings
          across every session of this activity (as it did pre-split)
          — once per-session rosters ship we'll move this section
          back up into the header. */}
      <SessionsManager
        activityId={activity.id}
        durationMinutes={activity.duration_minutes}
        sessions={sessions}
      />

      {/* Roster table */}
      <h2 className="text-lg font-semibold text-charcoal mb-3">
        {t("title")}
      </h2>
      {bookings.length === 0 ? (
        <div className="text-center py-10 text-charcoal-lighter">
          {t("empty")}
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-charcoal-lighter border-b border-charcoal-lighter/10">
              <tr>
                <th className="text-left px-4 py-3">{t("bookedBy")}</th>
                <th className="text-left px-4 py-3">{t("seatsBookedCol")}</th>
                <th className="text-left px-4 py-3">{t("totalPaid")}</th>
                <th className="text-left px-4 py-3">{t("statusCol")}</th>
                <th className="text-left px-4 py-3">{t("bookedAt")}</th>
                {isPast && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-lighter/10">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center font-semibold">
                        {b.users.name[0]?.toUpperCase() || "?"}
                      </div>
                      <span className="font-medium text-charcoal">
                        {b.users.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{b.seats_booked}</td>
                  <td className="px-4 py-3">
                    {formatCurrency(b.total_price_cents)}
                  </td>
                  <td className="px-4 py-3 capitalize">{b.status}</td>
                  <td className="px-4 py-3 text-charcoal-lighter">
                    {formatDate(b.created_at.slice(0, 10), locale)}
                  </td>
                  {isPast && (
                    <td className="px-4 py-3 text-right">
                      <MarkNoShowButton
                        bookingId={b.id}
                        alreadyMarked={b.no_show}
                        enabled={canMarkNoShow({
                          status: b.status,
                          noShow: b.no_show,
                          activityDate: activity.date,
                          today,
                        })}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
