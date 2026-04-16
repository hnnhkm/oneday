"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCheckoutSessionAction } from "@/lib/actions/checkout";
import { formatCurrency } from "@/lib/utils";
import { useBookingFlow } from "./booking-flow/booking-flow-context";
import type { ActivitySessionSummary } from "@/lib/queries/activities";

interface BookingFormProps {
  pricePerSeatCents: number;
  isAuthed: boolean;
  /**
   * When true the parent determined the entire activity is sold
   * out (e.g. every session maxed). We still render a disabled
   * state instead of the picker.
   */
  isSoldOut: boolean;
  /**
   * True when the currently-signed-in user is the instructor who
   * owns this activity. Replaces the booking form with a gentle
   * "this is your activity" notice and a link to the instructor
   * dashboard. Server-side guards (in createCheckoutSessionAction
   * and the book_session RPC) enforce the same thing regardless.
   */
  isOwnActivity?: boolean;
  /**
   * Activity's min_participants. 0 means no minimum — no quorum
   * promise line renders. > 0 shows "Mínimo de N participantes —
   * confirmada 24h antes" above the submit button.
   */
  minParticipants: number;
}

export function BookingForm({
  pricePerSeatCents,
  isAuthed,
  isSoldOut,
  isOwnActivity = false,
  minParticipants,
}: BookingFormProps) {
  const t = useTranslations("booking");
  const locale = useLocale() as "pt" | "en" | "es";
  const router = useRouter();

  // Selection lives in `BookingFlowProvider` — shared with the
  // `SessionPicker` in the left column so the user picks the
  // session there and the form just reflects + books it.
  const { selectedSession } = useBookingFlow();
  const sessionId = selectedSession?.id ?? null;
  const seatsRemaining = selectedSession?.seats_remaining ?? 0;
  const maxSelectable = Math.max(1, Math.min(seatsRemaining, 10));

  const [seats, setSeats] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // If the user switches to a session with fewer remaining seats
  // than they currently have selected, snap the seat count down.
  // Without this, the `<select>` ends up with a value that's not
  // in its option list (e.g. "4" selected when only 2 seats are
  // available) and React renders blank. Effect lives BEFORE the
  // early returns so hook order stays stable across renders.
  useEffect(() => {
    if (seats > maxSelectable) setSeats(maxSelectable);
  }, [seats, maxSelectable]);

  if (!isAuthed) {
    return (
      <Link href="/login">
        <Button className="w-full" size="lg" disabled={isSoldOut}>
          {isSoldOut ? t("errorNotEnoughSeats") : t("loginToBook")}
        </Button>
      </Link>
    );
  }

  // Instructor viewing their own activity: show a friendly notice
  // instead of a booking form. The backend would reject this
  // anyway, but a disabled button is worse UX than explaining why
  // there's no button.
  if (isOwnActivity) {
    return (
      <div className="rounded-md bg-primary-50 border border-primary-100 p-4 text-sm text-charcoal">
        <p className="font-medium mb-1">{t("ownActivityTitle")}</p>
        <p className="text-charcoal-lighter mb-3">
          {t("ownActivityBody")}
        </p>
        <Link
          href="/instructor"
          className="inline-block text-sm font-medium text-primary-500 hover:text-primary-600"
        >
          {t("ownActivityCta")} →
        </Link>
      </div>
    );
  }

  const total = pricePerSeatCents * seats;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sessionId) {
      setError(t("errorNotEnoughSeats"));
      return;
    }
    startTransition(async () => {
      const result = await createCheckoutSessionAction(
        sessionId,
        seats,
        locale
      );
      if (!result.ok) {
        const raw = result.error || "";
        if (raw.includes("not enough seats")) {
          setError(t("errorNotEnoughSeats"));
        } else if (raw.includes("past")) {
          setError(t("errorPastActivity"));
        } else {
          setError(raw || t("errorGeneric"));
        }
        return;
      }
      // Real Stripe path: external redirect to checkout.stripe.com.
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      // Mock path: Phase 4 behavior, stay in-app and route to the
      // confirmation page for the freshly created booking.
      if (result.bookingId) {
        router.push(
          `/bookings/${result.bookingId}/confirmation` as "/bookings"
        );
        return;
      }
      setError(t("errorGeneric"));
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Selected session summary — mirrors the picker's current
          selection so the user confirms what they're booking right
          next to the submit button, without having to scroll back
          up to the picker. When nothing is selected (e.g. every
          session is past/sold out), we show a "pick a date" hint
          instead; the submit button stays disabled via `sessionId`
          being null. */}
      {selectedSession ? (
        <div className="rounded-md bg-background-muted px-3 py-2 text-sm text-charcoal">
          {formatSessionOption(selectedSession, locale)}
        </div>
      ) : (
        <div className="rounded-md bg-background-muted px-3 py-2 text-sm text-charcoal-lighter">
          {t("pickSessionHint")}
        </div>
      )}

      <div>
        <label
          htmlFor="booking-seats"
          className="block text-xs font-medium text-charcoal mb-1"
        >
          {t("seatsLabel")}
        </label>
        <Select
          value={String(seats)}
          onValueChange={(v) => setSeats(Number(v))}
          disabled={isSoldOut || isPending}
        >
          <SelectTrigger id="booking-seats">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: maxSelectable }, (_, i) => i + 1).map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-charcoal-lighter">{t("totalLabel")}</span>
        <span className="font-semibold text-charcoal">
          {formatCurrency(total)}
        </span>
      </div>

      {minParticipants > 0 && (
        <p className="text-xs text-charcoal-lighter">
          {t("quorumPromise", { min: minParticipants })}
        </p>
      )}

      <label className="flex items-start gap-2 text-xs text-charcoal-lighter cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>{t("agreePolicy")}</span>
      </label>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isSoldOut || !agreed || isPending || !sessionId}
      >
        {isPending ? t("submitting") : t("submit")}
      </Button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

/**
 * Render a session's date + time in the user's locale, always in São
 * Paulo wall-clock. Format: "Sat, Apr 20 · 2:00 PM" (en) /
 * "sáb, 20 de abr · 14:00" (pt). Intl handles the rest.
 */
function formatSessionOption(
  session: ActivitySessionSummary,
  locale: "pt" | "en" | "es"
): string {
  const localeMap = { pt: "pt-BR", en: "en-US", es: "es-ES" } as const;
  const intlLocale = localeMap[locale] ?? "pt-BR";
  const d = new Date(session.starts_at);
  const date = d.toLocaleDateString(intlLocale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
  const time = d.toLocaleTimeString(intlLocale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${date} · ${time}`;
}
