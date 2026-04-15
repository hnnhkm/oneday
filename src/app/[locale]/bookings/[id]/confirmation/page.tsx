import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { fetchBookingById } from "@/lib/queries/bookings";
import { getUser } from "@/lib/supabase/get-user";
import {
  formatCurrency,
  formatDate,
  formatTime,
  getTranslatedField,
} from "@/lib/utils";
import type { TranslatedField } from "@/lib/types/database";

interface ConfirmationPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingConfirmationPage({
  params,
}: ConfirmationPageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("booking");
  const tBookings = await getTranslations("bookings");

  const user = await getUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const booking = await fetchBookingById(id);
  if (!booking || booking.user_id !== user.id) {
    notFound();
  }

  const title = getTranslatedField(
    booking.activities.title as TranslatedField,
    locale
  );
  const dateText = formatDate(booking.activities.date, locale);
  const shareText = t("shareText", { title, date: dateText });
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="bg-white rounded-lg shadow-card overflow-hidden">
        <div className="relative w-full aspect-[16/9]">
          <Image
            src={booking.activities.cover_image_url}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
            priority
          />
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex justify-center mb-4">
            <div className="text-5xl">🎉</div>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-charcoal text-center mb-2">
            {t("confirmationTitle")}
          </h1>
          <p className="text-charcoal-lighter text-center mb-6">
            {t("confirmationSubtitle")}
          </p>

          <div className="border-t border-charcoal-lighter/10 pt-6 space-y-3">
            <h2 className="font-semibold text-charcoal">{title}</h2>
            <div className="text-sm text-charcoal-lighter space-y-1">
              <p>
                📅 {dateText} · {formatTime(booking.activities.time)}
              </p>
              <p>
                📍 {booking.activities.address},{" "}
                {booking.activities.neighborhood}
              </p>
              <p>
                🎟️{" "}
                {tBookings("seatsBooked", { count: booking.seats_booked })} ·{" "}
                {tBookings("totalPaid")}:{" "}
                {formatCurrency(booking.total_price_cents)}
              </p>
            </div>
            <p className="text-xs text-charcoal-lighter pt-2">
              {t("bookingNumber")}: {booking.id.slice(0, 8).toUpperCase()}
            </p>
          </div>

          {booking.activities.min_participants > 0 &&
            booking.session &&
            booking.session.quorum_state !== "confirmed" && (
              <div className="mt-4 rounded-md bg-background-muted px-4 py-3 text-sm text-charcoal">
                {t("quorumPostBookingNotice", {
                  min: booking.activities.min_participants,
                })}
              </div>
            )}

          <div className="border-t border-charcoal-lighter/10 mt-6 pt-6 flex flex-col gap-3">
            <Link href="/bookings">
              <Button className="w-full" size="lg">
                {t("viewMyBookings")}
              </Button>
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button variant="outline" className="w-full">
                💬 {t("shareWhatsapp")}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
