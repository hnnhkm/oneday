import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/**
 * One parametric email template that all notification types share.
 * We pass the existing notification.title + notification.body
 * straight through — this template adds branding, a CTA button,
 * and the footer disclaimer that would be tedious to re-wrap in
 * every trigger SQL function.
 *
 * Email styles are inlined via React Email's component primitives,
 * which compile to tables + inline styles so that Gmail, Outlook
 * and friends render consistently.
 */

export interface NotificationEmailProps {
  title: string;
  body: string;
  recipientName: string;
  ctaUrl: string;
  ctaLabel: string;
  footerNote?: string;
}

export function NotificationEmail({
  title,
  body,
  recipientName,
  ctaUrl,
  ctaLabel,
  footerNote = "Você está recebendo este e-mail porque tem uma conta no oneday.",
}: NotificationEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{title}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={brandSection}>
            <Heading as="h1" style={brandHeading}>
              oneday
            </Heading>
          </Section>

          <Section style={contentSection}>
            <Text style={greetingStyle}>Olá, {recipientName}!</Text>
            <Heading as="h2" style={titleStyle}>
              {title}
            </Heading>
            <Text style={bodyStyleText}>{body}</Text>

            <Section style={ctaSection}>
              <Button href={ctaUrl} style={ctaButton}>
                {ctaLabel}
              </Button>
            </Section>
          </Section>

          <Hr style={hrStyle} />

          <Section style={footerSection}>
            <Text style={footerText}>{footerNote}</Text>
            <Text style={footerText}>
              <Link href={ctaUrl} style={footerLink}>
                oneday
              </Link>
              {" • "}São Paulo, Brasil
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ------------------------------------------------------------------
// Inline styles. Email clients strip external CSS, so everything is
// a JS object that React Email turns into inline style="..." attrs.
// ------------------------------------------------------------------

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f7f4ef",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "24px 16px",
};

const brandSection: React.CSSProperties = {
  textAlign: "center" as const,
  paddingBottom: "16px",
};

const brandHeading: React.CSSProperties = {
  color: "#f49271",
  fontSize: "22px",
  fontWeight: 700,
  margin: 0,
};

const contentSection: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "32px 28px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const greetingStyle: React.CSSProperties = {
  color: "#6b6562",
  fontSize: "14px",
  margin: "0 0 8px 0",
};

const titleStyle: React.CSSProperties = {
  color: "#2e2a27",
  fontSize: "22px",
  fontWeight: 600,
  margin: "0 0 16px 0",
  lineHeight: "1.3",
};

const bodyStyleText: React.CSSProperties = {
  color: "#4a4541",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 24px 0",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "8px 0 0 0",
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#f49271",
  color: "#ffffff",
  padding: "12px 28px",
  borderRadius: "6px",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e6e0d8",
  margin: "24px 0",
};

const footerSection: React.CSSProperties = {
  textAlign: "center" as const,
};

const footerText: React.CSSProperties = {
  color: "#9e9690",
  fontSize: "12px",
  margin: "4px 0",
};

const footerLink: React.CSSProperties = {
  color: "#f49271",
  textDecoration: "none",
};

// Default export so React Email's render(Component) signature works.
export default NotificationEmail;
