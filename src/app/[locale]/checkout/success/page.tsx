import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/get-user";

/**
 * Post-checkout landing page. Stripe redirects here with
 * `?session_id=cs_...`. The webhook may still be in flight, so we
 * poll the DB for up to ~8 seconds looking for a booking whose
 * stripe_session_id matches. Once found, we redirect to the real
 * confirmation page. If the session ID isn't known (direct hit,
 * refresh after long delay) we fall back to /bookings.
 */
interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

const POLL_ATTEMPTS = 8;
const POLL_DELAY_MS = 1000;

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const locale = await getLocale();
  const { session_id: sessionId } = await searchParams;

  const user = await getUser();
  if (!user) redirect(`/${locale}/login`);
  if (!sessionId) redirect(`/${locale}/bookings`);

  const admin = createAdminClient();

  // Poll in 1s increments. The webhook usually beats us here but
  // cold-start latency can push the first attempt out a few seconds.
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    const { data: booking } = await admin
      .from("bookings")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (booking && "id" in booking) {
      const bookingId = (booking as { id: string }).id;
      redirect(`/${locale}/bookings/${bookingId}/confirmation`);
    }
    await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
  }

  // Webhook never arrived (or is delayed further). Show a holding
  // message and let the user navigate to their bookings list.
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="text-5xl mb-4">⏳</div>
      <h1 className="text-2xl font-bold text-charcoal mb-3">
        Finalizando sua reserva...
      </h1>
      <p className="text-charcoal-lighter mb-6">
        O pagamento foi recebido mas ainda estamos confirmando a reserva.
        Em instantes ela aparecerá em &ldquo;Minhas reservas&rdquo;.
      </p>
      <a
        href={`/${locale}/bookings`}
        className="inline-block px-5 py-2.5 rounded bg-primary-400 text-white font-medium hover:bg-primary-500"
      >
        Ver minhas reservas
      </a>
    </div>
  );
}
