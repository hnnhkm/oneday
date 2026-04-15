import { Resend } from "resend";

/**
 * Thin wrapper around the Resend SDK.
 *
 * Dry-run mode: if RESEND_API_KEY is not set (local dev without a
 * real key, CI without secrets), the wrapper logs the outgoing email
 * instead of sending it. Callers still see a success result so the
 * dispatcher can stamp `email_sent_at` and not retry forever.
 *
 * In production the env var MUST be set; the dispatcher will still
 * succeed in dry-run mode if you forget to set it, which could be a
 * silent failure. Guard that at deploy time, not here.
 */

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ||
  "oneday <noreply@oneday.app>";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "your_resend_api_key") return null;
  if (!cachedClient) cachedClient = new Resend(key);
  return cachedClient;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(
  params: SendEmailParams
): Promise<{ ok: boolean; error?: string }> {
  const client = getClient();

  if (!client) {
    // Dry run: visible in server logs so you can see dispatch wiring
    // works end-to-end without setting up a real key.
    console.log(
      `[email:dry-run] to=${params.to} subject="${params.subject}" bodyLen=${params.text.length}`
    );
    return { ok: true };
  }

  const { error } = await client.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });

  if (error) {
    console.error("[email:send-error]", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
