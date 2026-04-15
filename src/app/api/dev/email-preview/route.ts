import { NextResponse } from "next/server";
import { renderNotificationEmail } from "@/lib/email-templates/render";
import type { NotificationType } from "@/lib/types/database";

/**
 * Dev-only preview endpoint for the notification email template.
 * Hit /api/dev/email-preview?type=booking_confirmed to see a full
 * rendered HTML page. NODE_ENV-guarded like the other dev endpoints.
 *
 * Sample copy lives in the SAMPLES map below so we can eyeball every
 * notification type without fabricating DB rows.
 */

export const dynamic = "force-dynamic";

const SAMPLES: Record<NotificationType, { title: string; body: string }> = {
  booking_confirmed: {
    title: "Reserva confirmada",
    body: 'Sua reserva em "Aula de Culinária Italiana: Massas Frescas" foi confirmada. Até lá!',
  },
  booking_cancelled: {
    title: "Reserva cancelada",
    body: 'Sua reserva em "Aula de Culinária Italiana" foi cancelada. Você receberá o reembolso conforme a política da atividade.',
  },
  activity_reminder: {
    title: "Lembrete: atividade amanhã",
    body: 'Sua atividade "Workshop de Fotografia" acontece amanhã às 14:00. Até lá!',
  },
  review_prompt: {
    title: "Como foi sua atividade?",
    body: 'Conte sua experiência em "Aula de Yoga no Parque". Sua avaliação ajuda outros participantes!',
  },
  no_show_charged: {
    title: "Marcado como ausente",
    body: 'Você foi marcado como ausente na atividade "Workshop de Aquarela". Uma taxa de R$ 50,00 foi registrada.',
  },
  instructor_approved: {
    title: "Aplicação aprovada",
    body: "Parabéns! Sua aplicação foi aprovada. Agora você pode criar e publicar atividades.",
  },
  instructor_rejected: {
    title: "Aplicação não aprovada",
    body: "Sua aplicação não foi aprovada desta vez. Motivo: Documentação incompleta.",
  },
  payout_sent: {
    title: "Repasse enviado",
    body: "Um repasse de R$ 250,00 foi enviado para sua conta Stripe.",
  },
  activity_flagged: {
    title: "Atividade sinalizada",
    body: 'Sua atividade "Workshop de Aquarela" foi sinalizada para revisão pela equipe de moderação.',
  },
  saved_search_matched: {
    title: "Nova atividade: Yoga ao Amanhecer",
    body: 'A atividade "Yoga ao Amanhecer" corresponde à sua busca salva "Yoga no parque". [50000000-0000-0000-0000-000000000007]',
  },
  session_quorum_at_risk: {
    title: "Sessão abaixo do mínimo",
    body: "A sessão de \"Aula de Culinária Italiana\" está abaixo do mínimo: 2/5 participantes. Confirme que vai rodar dentro de 2h, caso contrário ela será cancelada automaticamente.",
  },
  session_confirmed: {
    title: "Aula confirmada",
    body: "Boa notícia! A sessão de \"Aula de Culinária Italiana\" foi confirmada. Até lá!",
  },
};

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "booking_confirmed") as
    | NotificationType
    | string;

  if (!(type in SAMPLES)) {
    return new NextResponse(
      `Unknown notification type "${type}". Valid types: ${Object.keys(SAMPLES).join(
        ", "
      )}`,
      { status: 400 }
    );
  }

  const sample = SAMPLES[type as NotificationType];
  const rendered = renderNotificationEmail(
    { type: type as NotificationType, ...sample },
    "Ana Souza",
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  );

  return new NextResponse(rendered.html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
