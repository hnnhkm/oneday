import { renderNotificationEmail } from "@/lib/email-templates/render";
import type { NotificationType } from "@/lib/types/database";

const ORIGIN = "http://localhost:3000";

function renderFor(type: NotificationType, title: string, body: string) {
  return renderNotificationEmail(
    { type, title, body },
    "Ana Souza",
    ORIGIN
  );
}

describe("renderNotificationEmail", () => {
  it("includes title + body + recipient name in the HTML", () => {
    const r = renderFor(
      "booking_confirmed",
      "Reserva confirmada",
      "Sua reserva em Massas Frescas foi confirmada."
    );
    expect(r.subject).toBe("Reserva confirmada");
    expect(r.text).toContain("Massas Frescas");
    expect(r.html).toContain("Reserva confirmada");
    expect(r.html).toContain("Sua reserva em Massas Frescas");
    expect(r.html).toContain("Ana Souza");
  });

  it("points the CTA at /bookings for booking_confirmed", () => {
    const r = renderFor("booking_confirmed", "t", "b");
    expect(r.html).toContain(`${ORIGIN}/pt/bookings`);
    expect(r.html).toContain("Ver minhas reservas");
  });

  it("points the CTA at the past tab for review_prompt", () => {
    const r = renderFor("review_prompt", "t", "b");
    expect(r.html).toContain("/pt/bookings?tab=past");
    expect(r.html).toContain("Escrever avaliação");
  });

  it("points the CTA at /instructor for instructor_approved", () => {
    const r = renderFor("instructor_approved", "t", "b");
    expect(r.html).toContain(`${ORIGIN}/pt/instructor`);
  });

  it("points the CTA at the rejected page for instructor_rejected", () => {
    const r = renderFor("instructor_rejected", "t", "b");
    expect(r.html).toContain("/pt/instructor/rejected");
  });

  it("points the CTA at /instructor/payouts for payout_sent", () => {
    const r = renderFor("payout_sent", "t", "b");
    expect(r.html).toContain("/pt/instructor/payouts");
  });

  it("renders the brand header and footer", () => {
    const r = renderFor("booking_confirmed", "t", "b");
    expect(r.html).toContain("oneday");
    expect(r.html).toContain("São Paulo, Brasil");
  });
});
