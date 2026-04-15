import { redirect, notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { fetchBookingById } from "@/lib/queries/bookings";
import { fetchExistingReview } from "@/lib/queries/reviews";
import { getUser } from "@/lib/supabase/get-user";
import { getTranslatedField } from "@/lib/utils";
import { ReviewForm } from "@/components/bookings/review-form";
import type { TranslatedField } from "@/lib/types/database";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function WriteReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("review");

  const user = await getUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const booking = await fetchBookingById(id);
  if (!booking || booking.user_id !== user.id) {
    notFound();
  }

  const today = new Date().toISOString().slice(0, 10);
  const eligible =
    booking.activities.date < today && booking.status !== "cancelled";

  const title = getTranslatedField(
    booking.activities.title as TranslatedField,
    locale
  );

  if (!eligible) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="text-5xl mb-4">📅</div>
        <p className="text-charcoal-lighter">{t("notEligible")}</p>
      </div>
    );
  }

  const existing = await fetchExistingReview(user.id, booking.activity_id);
  if (existing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-charcoal-lighter">{t("alreadyReviewed")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-charcoal mb-2">
        {t("title")}
      </h1>
      <p className="text-charcoal-lighter mb-8">
        {t("subtitle", { title })}
      </p>
      <ReviewForm activityId={booking.activity_id} />
    </div>
  );
}
