import {
  NotificationEmail,
  type NotificationEmailProps,
} from "./notification-email";
import type { Notification, NotificationType } from "@/lib/types/database";

// Next.js's static bundler flags top-level `react-dom/server`
// imports as a client-component mistake. We only call this from
// server code (dispatcher + dev preview route) so the warning is a
// false positive. Load the module via `eval('require')` to bypass
// webpack's static analysis while still resolving at module init.
type ReactDomServer = {
  renderToStaticMarkup: (element: unknown) => string;
};
const reactDomServer: ReactDomServer =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (eval("require") as NodeRequire)("react-dom/server");
const { renderToStaticMarkup } = reactDomServer;

/**
 * Decide where the CTA button should point for each notification
 * type. All URLs are relative to the site origin which is passed
 * in alongside the notification row.
 */
function ctaForType(type: NotificationType): {
  path: string;
  labelPt: string;
} {
  switch (type) {
    case "booking_confirmed":
    case "activity_reminder":
      return { path: "/pt/bookings", labelPt: "Ver minhas reservas" };
    case "booking_cancelled":
      return { path: "/pt/bookings?tab=cancelled", labelPt: "Ver reservas canceladas" };
    case "review_prompt":
      return { path: "/pt/bookings?tab=past", labelPt: "Escrever avaliação" };
    case "instructor_approved":
      return { path: "/pt/instructor", labelPt: "Ir para o painel" };
    case "instructor_rejected":
      return { path: "/pt/instructor/rejected", labelPt: "Ver detalhes" };
    case "no_show_charged":
      return { path: "/pt/bookings?tab=past", labelPt: "Ver detalhes" };
    case "payout_sent":
      return { path: "/pt/instructor/payouts", labelPt: "Ver repasses" };
    case "activity_flagged":
      return { path: "/pt/instructor/activities", labelPt: "Ver minhas atividades" };
    case "saved_search_matched":
      return { path: "/pt/activities", labelPt: "Ver atividades" };
    case "session_quorum_at_risk":
      return { path: "/pt/instructor", labelPt: "Ir para o painel" };
    case "session_confirmed":
      return { path: "/pt/bookings", labelPt: "Ver minhas reservas" };
  }
}

export interface RenderedNotificationEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Render a notification row as an email envelope. The returned
 * `text` is the row's body unchanged — email clients that can't
 * render HTML fall back to this. The returned `html` is the
 * React-Email'd branded template.
 */
export function renderNotificationEmail(
  notification: Pick<Notification, "type" | "title" | "body">,
  recipientName: string,
  siteOrigin: string
): RenderedNotificationEmail {
  const cta = ctaForType(notification.type);
  const ctaUrl = `${siteOrigin.replace(/\/$/, "")}${cta.path}`;

  const props: NotificationEmailProps = {
    title: notification.title,
    body: notification.body,
    recipientName,
    ctaUrl,
    ctaLabel: cta.labelPt,
  };

  // React Email's primitives (Html/Head/Body/Container/...) are
  // plain React components that compile to email-safe markup, so
  // renderToStaticMarkup works directly. This sidesteps the
  // dynamic-import path in @react-email/render/node which Jest
  // doesn't support without ESM mode, and it also avoids an
  // unnecessary async boundary.
  const markup = renderToStaticMarkup(NotificationEmail(props));
  const html = `<!doctype html>${markup}`;

  return {
    subject: notification.title,
    html,
    text: notification.body,
  };
}
