import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEmailsForUsers } from "@/lib/notifications/dispatch-emails";

/**
 * Daily cron endpoint.
 *
 * Runs three SQL jobs in order:
 *   1. auto_complete_past_activities()
 *   2. queue_activity_reminders()      → returns user_ids
 *   3. queue_review_prompts()          → returns user_ids
 *
 * Then drains email for every affected user via the Phase 7
 * dispatcher. Returns a JSON summary so the external scheduler
 * can log job counts.
 *
 * Authorization: `Authorization: Bearer $CRON_SECRET` header. No
 * secret set → 500 (deployment misconfiguration). Missing/wrong
 * header → 401.
 *
 * Invocation patterns:
 *   - Vercel Cron: vercel.json with a crons[] entry hitting this
 *     route.
 *   - GitHub Actions: scheduled workflow curling the URL.
 *   - Supabase pg_net + pg_cron: schedule a Postgres function
 *     that calls this endpoint from inside the DB.
 *
 * For local dev: curl it directly.
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
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Auto-complete past activities
  const { data: completedCount, error: completeErr } = await admin.rpc(
    "auto_complete_past_activities"
  );
  if (completeErr) {
    return NextResponse.json(
      { ok: false, error: `auto_complete failed: ${completeErr.message}` },
      { status: 500 }
    );
  }

  // 2. Queue reminders for tomorrow's activities
  const { data: reminderUsers, error: reminderErr } = await admin.rpc(
    "queue_activity_reminders"
  );
  if (reminderErr) {
    return NextResponse.json(
      { ok: false, error: `queue_reminders failed: ${reminderErr.message}` },
      { status: 500 }
    );
  }

  // 3. Queue review prompts for yesterday's activities
  const { data: reviewUsers, error: reviewErr } = await admin.rpc(
    "queue_review_prompts"
  );
  if (reviewErr) {
    return NextResponse.json(
      { ok: false, error: `queue_review_prompts failed: ${reviewErr.message}` },
      { status: 500 }
    );
  }

  // 4. Match saved searches against newly published activities
  const { data: savedSearchUsers, error: savedSearchErr } = await admin.rpc(
    "queue_saved_search_matches"
  );
  if (savedSearchErr) {
    return NextResponse.json(
      { ok: false, error: `queue_saved_search_matches failed: ${savedSearchErr.message}` },
      { status: 500 }
    );
  }

  // Drain email for every user that got something. Dedupe so the
  // same user doesn't hit the dispatcher twice when they received
  // both a reminder and a review prompt in one run.
  const toNotify = [
    ...(reminderUsers as Array<{ affected_user_id: string }> | null || []),
    ...(reviewUsers as Array<{ affected_user_id: string }> | null || []),
    ...(savedSearchUsers as Array<{ affected_user_id: string }> | null || []),
  ].map((r) => r.affected_user_id);

  await dispatchEmailsForUsers(toNotify);

  return NextResponse.json({
    ok: true,
    autoCompletedActivities: completedCount || 0,
    remindersQueued: (reminderUsers || []).length,
    reviewPromptsQueued: (reviewUsers || []).length,
    savedSearchMatchesQueued: (savedSearchUsers || []).length,
  });
}
