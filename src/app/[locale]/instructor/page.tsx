import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/instructor/stat-card";
import { requireApprovedInstructor } from "@/lib/supabase/require-approved-instructor";
import { createClient } from "@/lib/supabase/server";
import {
  fetchDashboardStats,
  fetchMyActivities,
  fetchAllInstructorBookings,
  fetchInstructorNotifications,
} from "@/lib/queries/instructor";
import {
  formatCurrency,
  formatDate,
  formatTime,
  getTranslatedField,
} from "@/lib/utils";
import type { TranslatedField } from "@/lib/types/database";
import { AtRiskSessionsCard, type AtRiskSession } from "@/components/instructor/at-risk-sessions-card";

export default async function InstructorDashboardPage() {
  const locale = await getLocale();
  const t = await getTranslations("instructor.dashboard");

  const { user, profile } = await requireApprovedInstructor();
  const supabase = await createClient();

  // Pull sessions currently in at_risk state owned by this instructor.
  const { data: atRisk } = await supabase
    .from("activity_sessions")
    .select(
      `
      id,
      starts_at,
      max_seats,
      seats_remaining,
      activities!inner (
        id,
        instructor_id,
        min_participants,
        title
      )
    `
    )
    .eq("quorum_state", "at_risk")
    .eq("activities.instructor_id", profile.id)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  type AtRiskRow = {
    id: string;
    starts_at: string;
    max_seats: number;
    seats_remaining: number;
    activities: {
      id: string;
      instructor_id: string;
      min_participants: number;
      title: Record<string, string>;
    };
  };

  const atRiskSessions: AtRiskSession[] = (atRisk ?? []).map((rawRow) => {
    const row = rawRow as unknown as AtRiskRow;
    const activities = Array.isArray(row.activities)
      ? row.activities[0]
      : row.activities;
    return {
      sessionId: row.id,
      activityTitle: activities.title[locale] ?? activities.title.pt,
      startsAt: row.starts_at,
      booked: row.max_seats - row.seats_remaining,
      minParticipants: activities.min_participants,
    };
  });

  const [stats, activities, bookings, notificationsPage] = await Promise.all([
    fetchDashboardStats(profile.id, profile.commission_rate),
    fetchMyActivities(profile.id),
    fetchAllInstructorBookings(profile.id),
    fetchInstructorNotifications(user.id, 1, 3),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingActivities = activities
    .filter((a) => a.status === "published" && a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const recentBookings = bookings.slice(0, 5);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
        {t("title", { name: user.name })}
      </h1>

      <AtRiskSessionsCard initialSessions={atRiskSessions} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="🎨"
          label={t("statTotalActivities")}
          value={String(stats.totalActivities)}
          sub={`${stats.upcomingActivitiesCount} próximas`}
        />
        <StatCard
          icon="🎟️"
          label={t("statUpcomingBookings")}
          value={String(stats.upcomingBookingsCount)}
        />
        <StatCard
          icon="💰"
          label={t("statMonthEarnings")}
          value={formatCurrency(stats.monthToDateEarningsCents)}
          sub={formatCurrency(stats.allTimeEarningsCents)}
        />
        <StatCard
          icon="⭐"
          label={t("statRating")}
          value={stats.avgRating ? stats.avgRating.toFixed(1) : "—"}
          sub={`${stats.reviewCount} avaliações`}
        />
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-charcoal mb-3">
          {t("quickActions")}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/instructor/activities/new">
            <Button>{t("newActivity")}</Button>
          </Link>
          <Link href="/instructor/activities">
            <Button variant="outline">{t("viewAllActivities")}</Button>
          </Link>
        </div>
      </div>

      {/* Upcoming activities */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-charcoal mb-3">
          {t("upcomingActivitiesTitle")}
        </h2>
        {upcomingActivities.length === 0 ? (
          <p className="text-charcoal-lighter text-sm">{t("noUpcoming")}</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {upcomingActivities.map((a) => (
              <Link
                key={a.id}
                href={`/instructor/activities/${a.id}` as "/instructor/activities"}
                className="flex-shrink-0 w-64 rounded-lg bg-white shadow-card overflow-hidden hover:shadow-card-hover transition-shadow"
              >
                <div className="aspect-video bg-background-muted relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.cover_image_url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <div className="font-medium text-charcoal line-clamp-1">
                    {getTranslatedField(a.title as TranslatedField, locale)}
                  </div>
                  <div className="text-xs text-charcoal-lighter mt-1">
                    {formatDate(a.date, locale)} · {formatTime(a.time)}
                  </div>
                  <div className="text-xs text-charcoal-lighter">
                    {a.seats_remaining}/{a.max_seats} vagas restantes
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent bookings */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-charcoal mb-3">
          {t("recentBookingsTitle")}
        </h2>
        {recentBookings.length === 0 ? (
          <p className="text-charcoal-lighter text-sm">{t("noBookings")}</p>
        ) : (
          <div className="rounded-lg bg-white shadow-card divide-y divide-charcoal-lighter/10">
            {recentBookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 p-3 text-sm"
              >
                <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center font-semibold flex-shrink-0">
                  {b.users.name[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-charcoal truncate">
                    {b.users.name}
                  </div>
                  <div className="text-xs text-charcoal-lighter truncate">
                    {getTranslatedField(
                      b.activities.title as TranslatedField,
                      locale
                    )}{" "}
                    · {formatDate(b.activities.date, locale)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-medium text-charcoal">
                    {formatCurrency(b.total_price_cents)}
                  </div>
                  <div className="text-xs text-charcoal-lighter">
                    {b.seats_booked}× assentos
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notices */}
      <div>
        <h2 className="text-lg font-semibold text-charcoal mb-3">
          {t("noticesTitle")}
        </h2>
        {notificationsPage.rows.length === 0 ? (
          <p className="text-charcoal-lighter text-sm">{t("noNotices")}</p>
        ) : (
          <div className="rounded-lg bg-white shadow-card divide-y divide-charcoal-lighter/10">
            {notificationsPage.rows.map((n) => (
              <div key={n.id} className="p-3 text-sm">
                <div className="font-medium text-charcoal">{n.title}</div>
                <div className="text-xs text-charcoal-lighter">{n.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
