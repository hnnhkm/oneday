import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEmailsForUsers } from "@/lib/notifications/dispatch-emails";

/**
 * Hourly cron endpoint. Drives the quorum state machine:
 *   1. evaluate_session_quorum() — flips pending → at_risk for
 *      sessions starting in 22-26h that are still below minimum
 *   2. expire_at_risk_sessions() — cancels at_risk sessions past
 *      the 2h confirmation window with no instructor override
 *
 * Both return sets of user ids that got notifications; we drain
 * their email via the existing dispatcher.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (same pattern as the
 * daily route). Missing/wrong secret → 401. Missing env → 500.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const admin = createAdminClient();

  // 1. Flag at-risk sessions.
  const { data: atRiskUsers, error: evalErr } = await admin.rpc(
    "evaluate_session_quorum"
  );
  if (evalErr) {
    return NextResponse.json(
      { ok: false, error: `evaluate_session_quorum failed: ${evalErr.message}` },
      { status: 500 }
    );
  }

  // 2. Expire at-risk sessions past their confirmation window.
  const { data: expiredUsers, error: expErr } = await admin.rpc(
    "expire_at_risk_sessions"
  );
  if (expErr) {
    return NextResponse.json(
      { ok: false, error: `expire_at_risk_sessions failed: ${expErr.message}` },
      { status: 500 }
    );
  }

  // Drain email for every affected user. `dispatchEmailsForUsers`
  // dedupes internally so the same instructor-also-booker doesn't
  // get processed twice when both RPCs touched them.
  const toNotify = [
    ...(atRiskUsers as Array<{ affected_user_id: string }> | null || []),
    ...(expiredUsers as Array<{ affected_user_id: string }> | null || []),
  ].map((r) => r.affected_user_id);

  await dispatchEmailsForUsers(toNotify);

  return NextResponse.json({
    ok: true,
    atRiskFlagged: (atRiskUsers || []).length,
    expiredCancelled: (expiredUsers || []).length,
  });
}
