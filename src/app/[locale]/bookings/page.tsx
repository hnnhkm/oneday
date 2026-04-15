import { redirect } from "next/navigation";
import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CancelBookingButton } from "@/components/bookings/cancel-booking-button";
import {
  fetchUserBookings,
  categorizeBooking,
  canCancelBooking,
  canReviewBooking,
  type BookingTab,
  type BookingWithActivity,
} from "@/lib/queries/bookings";
import {
  formatCurrency,
  formatDate,
  formatTime,
  getTranslatedField,
} from "@/lib/utils";
import { getUser } from "@/lib/supabase/get-user";
import type { TranslatedField } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface BookingsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

const TABS: BookingTab[] = ["upcoming", "past", "cancelled"];

export default async function BookingsPage({
  searchParams,
}: BookingsPageProps) {
  const locale = await getLocale();
  const t = await getTranslations("bookings");
  const params = await searchParams;

  const user = await getUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const activeTab: BookingTab = TABS.includes(params.tab as BookingTab)
    ? (params.tab as BookingTab)
    : "upcoming";

  const allBookings = await fetchUserBookings(user.id);
  const today = new Date().toISOString().slice(0, 10);

  const byTab = {
    upcoming: [] as BookingWithActivity[],
    past: [] as BookingWithActivity[],
    cancelled: [] as BookingWithActivity[],
  };
  for (const b of allBookings) {
    byTab[categorizeBooking(b, b.activities.date, today)].push(b);
  }

  const visible = byTab[activeTab];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
        {t("title")}
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-charcoal-lighter/10 mb-6">
        {TABS.map((tab) => {
          const count = byTab[tab].length;
          return (
            <Link
              key={tab}
              href={`/bookings?tab=${tab}` as "/bookings"}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab
                  ? "border-primary-400 text-primary-400"
                  : "border-transparent text-charcoal-lighter hover:text-charcoal"
              )}
            >
              {t(tabKey(tab))} {count > 0 && `(${count})`}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {visible.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-charcoal-lighter mb-6">{t(emptyKey(activeTab))}</p>
          <Link href="/activities">
            <Button>{t("emptyCta")}</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              locale={locale}
              today={today}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function tabKey(tab: BookingTab): "tabUpcoming" | "tabPast" | "tabCancelled" {
  if (tab === "upcoming") return "tabUpcoming";
  if (tab === "past") return "tabPast";
  return "tabCancelled";
}

function emptyKey(
  tab: BookingTab
): "emptyUpcoming" | "emptyPast" | "emptyCancelled" {
  if (tab === "upcoming") return "emptyUpcoming";
  if (tab === "past") return "emptyPast";
  return "emptyCancelled";
}

type BookingsT = Awaited<ReturnType<typeof getTranslations>>;

function BookingCard({
  booking,
  locale,
  today,
  t,
}: {
  booking: BookingWithActivity;
  locale: string;
  today: string;
  t: BookingsT;
}) {
  const title = getTranslatedField(
    booking.activities.title as TranslatedField,
    locale
  );
  const cancellable = canCancelBooking(
    booking,
    booking.activities.date,
    today
  );
  const reviewable = canReviewBooking(
    booking,
    booking.activities.date,
    today
  );

  const statusLabel =
    booking.status === "confirmed"
      ? t("statusConfirmed")
      : booking.status === "cancelled"
        ? t("statusCancelled")
        : booking.status === "completed"
          ? t("statusCompleted")
          : t("statusPending");

  return (
    <article className="flex flex-col sm:flex-row gap-4 bg-white rounded-lg shadow-card overflow-hidden">
      <div className="relative w-full sm:w-48 aspect-[4/3] sm:aspect-auto flex-shrink-0">
        <Image
          src={booking.activities.cover_image_url}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 192px"
        />
      </div>

      <div className="flex-1 p-4 sm:py-4 sm:pr-4 sm:pl-0 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-charcoal line-clamp-2">{title}</h3>
          <Badge
            className={cn(
              "flex-shrink-0",
              booking.status === "confirmed" && "bg-secondary-100 text-secondary-700",
              booking.status === "cancelled" && "bg-red-100 text-red-700",
              booking.status === "completed" && "bg-background-muted text-charcoal-lighter"
            )}
          >
            {statusLabel}
          </Badge>
        </div>

        <div className="text-sm text-charcoal-lighter space-y-0.5 mb-3">
          <p>
            📅 {formatDate(booking.activities.date, locale)} ·{" "}
            {formatTime(booking.activities.time)}
          </p>
          <p>
            📍 {booking.activities.neighborhood}, {booking.activities.city}
          </p>
          <p>
            🎟️ {t("seatsBooked", { count: booking.seats_booked })} ·{" "}
            {t("totalPaid")}: {formatCurrency(booking.total_price_cents)}
          </p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <Link
            href={`/activities/${booking.activity_id}`}
            className="text-sm text-primary-400 font-medium hover:underline"
          >
            {t("viewDetails")}
          </Link>
          {cancellable && (
            <CancelBookingButton
              bookingId={booking.id}
              activityDate={booking.activities.date}
              activityTime={booking.activities.time}
              totalPriceCents={booking.total_price_cents}
              cancellationPolicy={
                booking.activities.cancellation_policy as
                  | "flexible"
                  | "moderate"
                  | "strict"
              }
            />
          )}
          {reviewable && (
            <Link
              href={`/bookings/${booking.id}/review` as "/bookings"}
              className="text-sm text-primary-400 font-medium hover:underline"
            >
              ⭐ {t("writeReview")}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
