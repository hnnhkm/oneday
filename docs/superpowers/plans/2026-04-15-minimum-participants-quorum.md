# Minimum Participants (Quorum) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let instructors set a minimum number of participants per activity. Sessions that don't meet quorum by 24h before start are flagged at-risk; if the instructor doesn't confirm within 2h, the session auto-cancels and bookings are fully refunded.

**Architecture:** Activity-level `min_participants` column + session-level `quorum_state` state machine (`pending | confirmed | at_risk | cancelled`). A new hourly cron endpoint drives `pending → at_risk` and `at_risk → cancelled` transitions. The `book_session` RPC is amended to auto-flip `pending → confirmed` when a booking tips a session over the minimum. A single `cancel_session_with_refunds` RPC is the only code path that cancels a session (shared by instructor UI and cron). UI helper `getQuorumStatus()` renders motivating-not-discouraging progress indicators on time-slot cards.

**Tech Stack:** Postgres (migrations + PL/pgSQL), Supabase, Next.js 14 App Router, next-intl, Jest (unit + integration), Tailwind.

**Spec:** `docs/superpowers/specs/2026-04-15-minimum-participants-quorum-design.md`

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `supabase/migrations/00028_min_participants.sql` | Adds `activities.min_participants`, `activity_sessions.quorum_state`/`quorum_evaluated_at`/`instructor_confirmed_at`, and new enum values for `notification_type`. |
| `supabase/migrations/00029_cancel_session_rpc.sql` | Adds `cancel_session_with_refunds(session_id, reason)` — the single cancellation code path. |
| `supabase/migrations/00030_quorum_rpcs.sql` | Adds `confirm_session_quorum`, `evaluate_session_quorum`, `expire_at_risk_sessions` RPCs. Amends `book_session` + `book_session_from_webhook` for auto-confirm. |
| `src/lib/quorum.ts` | `getQuorumStatus()` pure helper — maps `(min, booked, state)` to a UI badge variant. |
| `src/app/api/cron/hourly/route.ts` | Hourly cron endpoint that runs `evaluate_session_quorum` then `expire_at_risk_sessions`, drains emails. |
| `src/lib/email/templates/session-quorum-at-risk.ts` | Email template for at-risk notification to instructor. |
| `src/lib/email/templates/session-confirmed.ts` | Email template sent to all booked participants when a session reaches quorum. |
| `__tests__/lib/quorum.test.ts` | Unit tests for `getQuorumStatus`. |
| `__tests__/integration/cancel-session-rpc.test.ts` | Integration tests for `cancel_session_with_refunds`. |
| `__tests__/integration/quorum-rpcs.test.ts` | Integration tests for confirm/evaluate/expire RPCs + auto-confirm on booking. |
| `vercel.json` | Register the hourly cron (file does not exist today — create it). |

### Modified files

| Path | Change |
|---|---|
| `src/lib/activity-validation.ts` | Add `min_participants` to `ActivityInput`, validate range + `<= max_seats`. |
| `src/lib/types/database.ts` | Add `min_participants` to `Activity`, add quorum fields to `ActivitySession`. |
| `src/components/instructor/activity-form.tsx` | Add "Mínimo de participantes" field. |
| `src/lib/queries/activities.ts` | Include `min_participants` in activity selects, `quorum_state` in session selects. |
| `src/app/[locale]/activities/[id]/page.tsx` | Pass `min_participants` to booking form. |
| `src/components/activities/booking-form.tsx` | Render quorum promise line when `min_participants > 0`. |
| `src/components/activities/booking-flow/session-picker.tsx` | Render quorum status badge on each time-slot card. |
| `src/app/[locale]/bookings/[id]/confirmation/page.tsx` | "Confirmed 24h before" notice for not-yet-confirmed sessions. |
| `src/lib/actions/sessions.ts` | Add `confirmSessionQuorumAction`, `cancelSessionAction` server actions. |
| `src/app/[locale]/instructor/page.tsx` | Add "Precisa de atenção" card for at-risk sessions. |
| `src/lib/notifications/dispatch-emails.ts` | Register the two new email types. |
| `src/messages/pt.json`, `en.json`, `es.json` | Translation keys. |

---

## Task 1: Schema migration — columns, constraints, enum values

**Files:**
- Create: `supabase/migrations/00028_min_participants.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Phase 12: minimum-participants quorum feature (schema).
--
-- Purely additive. Defaults leave every existing activity with
-- `min_participants = 0` (feature disabled) and every existing
-- session in `quorum_state = 'pending'`, which together are a
-- no-op for unchanged instructors.
--
-- Rollback: DROP COLUMNs and the added enum values; see bottom.
-- ============================================================

BEGIN;

-- --------------------------------------------------------------
-- activities: the opt-in threshold lives here, not on sessions.
-- --------------------------------------------------------------
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS min_participants INTEGER NOT NULL DEFAULT 0
    CHECK (min_participants >= 0);

-- Min must never exceed max; nonsensical otherwise. The form
-- validates too but we want a hard guarantee.
ALTER TABLE public.activities
  ADD CONSTRAINT min_participants_lte_max_seats
    CHECK (min_participants <= max_seats);

-- --------------------------------------------------------------
-- activity_sessions: quorum state machine.
--
-- Orthogonal to `status`. When quorum auto-cancel fires we flip
-- BOTH quorum_state = 'cancelled' AND status = 'cancelled' so
-- existing queries that filter by `status` keep working.
-- --------------------------------------------------------------
ALTER TABLE public.activity_sessions
  ADD COLUMN IF NOT EXISTS quorum_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (quorum_state IN ('pending', 'confirmed', 'at_risk', 'cancelled'));

ALTER TABLE public.activity_sessions
  ADD COLUMN IF NOT EXISTS quorum_evaluated_at TIMESTAMPTZ;

ALTER TABLE public.activity_sessions
  ADD COLUMN IF NOT EXISTS instructor_confirmed_at TIMESTAMPTZ;

-- Partial index on the at-risk subset: the cron polls this every
-- hour looking for sessions to expire. Most sessions are never
-- at_risk, so a partial index is much smaller than full.
CREATE INDEX IF NOT EXISTS idx_activity_sessions_at_risk
  ON public.activity_sessions (quorum_evaluated_at)
  WHERE quorum_state = 'at_risk';

-- --------------------------------------------------------------
-- notification_type: three new values.
--   session_quorum_at_risk — sent to instructor at T-24h
--   session_confirmed      — sent to all participants when quorum
--                            is reached (by booking OR by override)
--
-- booking_cancelled already exists and is reused for quorum auto-
-- cancel; the body text varies by reason.
-- --------------------------------------------------------------
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'session_quorum_at_risk';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'session_confirmed';

COMMIT;

-- Rollback (manual, for reference):
--   ALTER TABLE activities DROP CONSTRAINT min_participants_lte_max_seats;
--   ALTER TABLE activities DROP COLUMN min_participants;
--   DROP INDEX idx_activity_sessions_at_risk;
--   ALTER TABLE activity_sessions
--     DROP COLUMN instructor_confirmed_at,
--     DROP COLUMN quorum_evaluated_at,
--     DROP COLUMN quorum_state;
--   -- enum values cannot be dropped in Postgres; leave in place.
```

- [ ] **Step 2: Apply the migration locally**

Run:

```bash
cd /Users/hannahkim/Documents/Claude/hobby-marketplace
supabase db reset
```

Expected: reset runs cleanly and the new migration number appears in the output without errors.

- [ ] **Step 3: Verify in psql**

Run:

```bash
docker exec -i supabase_db_hobby-marketplace psql -U postgres <<'SQL'
\d public.activities
\d public.activity_sessions
SELECT unnest(enum_range(NULL::notification_type))::text;
SQL
```

Expected: `activities` shows `min_participants integer NOT NULL DEFAULT 0`; `activity_sessions` shows `quorum_state`, `quorum_evaluated_at`, `instructor_confirmed_at`; the enum list includes `session_quorum_at_risk` and `session_confirmed`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00028_min_participants.sql
git commit -m "feat(db): add min_participants + quorum state columns"
```

---

## Task 2: `cancel_session_with_refunds` RPC

**Files:**
- Create: `supabase/migrations/00029_cancel_session_rpc.sql`
- Test: `__tests__/integration/cancel-session-rpc.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `__tests__/integration/cancel-session-rpc.test.ts`:

```ts
/** @jest-environment node */

import {
  loadEnvLocal,
  serviceClient,
  authenticatedClient,
  seedActivity,
  cleanup,
} from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

loadEnvLocal();
const svc = serviceClient();

const STUDENT_ID = "30000000-0000-0000-0000-000000000001";
const INSTRUCTOR_USER_ID = "20000000-0000-0000-0000-000000000001";
const INSTRUCTOR_PROFILE_ID = "40000000-0000-0000-0000-000000000001";

const ACTIVITY_ID = "bbbbbb03-0000-0000-0000-000000000001";
let sessionId: string;
let bookingId: string;
let instructorClient: SupabaseClient;

beforeAll(async () => {
  instructorClient = await authenticatedClient("mariana@example.com");

  await seedActivity(svc, ACTIVITY_ID, INSTRUCTOR_PROFILE_ID, {
    max_seats: 10,
    seats_remaining: 10,
    price_cents: 10000,
  });

  // Create a session 48h in the future.
  const startsAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 50 * 3600 * 1000).toISOString();
  const { data: session } = await svc
    .from("activity_sessions")
    .insert({
      activity_id: ACTIVITY_ID,
      starts_at: startsAt,
      ends_at: endsAt,
      max_seats: 10,
      seats_remaining: 8,
      status: "published",
    })
    .select("id")
    .single();
  sessionId = session!.id as string;

  // Book 2 seats via the existing RPC.
  const { data: bid } = await svc.rpc("book_session_from_webhook", {
    p_user_id: STUDENT_ID,
    p_session_id: sessionId,
    p_seats: 2,
    p_stripe_session_id: `cs_test_cancel_${Date.now()}`,
  });
  bookingId = bid as string;
});

afterAll(async () => {
  await svc.from("notifications").delete().eq("user_id", STUDENT_ID).in("type", ["booking_cancelled"]);
  if (bookingId) await cleanup(svc, "bookings", [bookingId]);
  await cleanup(svc, "activities", [ACTIVITY_ID]);
});

describe("cancel_session_with_refunds RPC", () => {
  it("cancels session, flips bookings to cancelled+refunded with full amount, inserts booking_cancelled notification", async () => {
    const { data: affected, error } = await instructorClient.rpc(
      "cancel_session_with_refunds",
      { p_session_id: sessionId, p_reason: "quorum_not_met" }
    );
    expect(error).toBeNull();
    expect(affected).toBe(1);

    const { data: session } = await svc
      .from("activity_sessions")
      .select("status, quorum_state")
      .eq("id", sessionId)
      .single();
    expect(session!.status).toBe("cancelled");
    expect(session!.quorum_state).toBe("cancelled");

    const { data: booking } = await svc
      .from("bookings")
      .select("status, payment_status, refund_amount_cents, total_price_cents")
      .eq("id", bookingId)
      .single();
    expect(booking!.status).toBe("cancelled");
    expect(booking!.payment_status).toBe("refunded");
    expect(booking!.refund_amount_cents).toBe(booking!.total_price_cents);

    const { data: notifs } = await svc
      .from("notifications")
      .select("type, body")
      .eq("user_id", STUDENT_ID)
      .eq("type", "booking_cancelled");
    expect(notifs!.length).toBeGreaterThanOrEqual(1);
    expect(notifs!.some((n) => n.body.includes("mínimo"))).toBe(true);
  });

  it("refuses to cancel a session that is already cancelled", async () => {
    const { error } = await instructorClient.rpc(
      "cancel_session_with_refunds",
      { p_session_id: sessionId, p_reason: "instructor_cancelled" }
    );
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/already.*cancelled|not.*cancellable/i);
  });

  it("rejects callers who do not own the activity", async () => {
    // Seed a second session and try to cancel it from a non-owner session.
    const startsAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 74 * 3600 * 1000).toISOString();
    const { data: s2 } = await svc
      .from("activity_sessions")
      .insert({
        activity_id: ACTIVITY_ID,
        starts_at: startsAt,
        ends_at: endsAt,
        max_seats: 10,
        seats_remaining: 10,
        status: "published",
      })
      .select("id")
      .single();

    const studentClient = await authenticatedClient("ana@example.com");
    const { error } = await studentClient.rpc("cancel_session_with_refunds", {
      p_session_id: s2!.id,
      p_reason: "instructor_cancelled",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not_authorized|not authorized/i);

    await svc.from("activity_sessions").delete().eq("id", s2!.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/integration/cancel-session-rpc.test.ts -v`

Expected: FAIL with error like `Could not find the function public.cancel_session_with_refunds`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/00029_cancel_session_rpc.sql`:

```sql
-- ============================================================
-- Phase 12: cancel_session_with_refunds
--
-- Per-session analog of cancel_activity_with_refunds (00005).
-- Single code path for cancelling a session — called by both
-- the instructor dashboard's "Cancelar" button AND the hourly
-- cron's expire function. Shared path = identical behavior
-- regardless of trigger, and regression risk has one home.
--
-- Refund amount is always 100% of what the participant paid,
-- because this path only runs for system-initiated cancels
-- (quorum not met) or instructor-initiated cancels that are
-- independent of the participant. The cancellation policy
-- (flexible/moderate/strict) only applies to PARTICIPANT-
-- initiated cancels, which flow through cancelBookingAction
-- (not this RPC).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cancel_session_with_refunds(
  p_session_id UUID,
  p_reason     TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid          UUID := auth.uid();
  v_instructor_profile  UUID;
  v_session             RECORD;
  v_title               TEXT;
  v_starts_at           TIMESTAMPTZ;
  v_affected            INT := 0;
  v_booking             RECORD;
  v_body                TEXT;
BEGIN
  -- ------------------------------------------------------------
  -- Load the session + parent activity in one shot.
  -- ------------------------------------------------------------
  SELECT
    s.id, s.activity_id, s.starts_at, s.status,
    a.instructor_id,
    COALESCE(a.title->>'pt', 'atividade') AS title_pt
  INTO v_session
  FROM public.activity_sessions s
  JOIN public.activities a ON a.id = s.activity_id
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status = 'cancelled' THEN
    RAISE EXCEPTION 'session_already_cancelled' USING ERRCODE = 'P0001';
  END IF;

  IF v_session.starts_at < now() THEN
    RAISE EXCEPTION 'session_already_started' USING ERRCODE = 'P0001';
  END IF;

  -- ------------------------------------------------------------
  -- Authz: either the instructor owns the activity, OR the caller
  -- has no auth.uid() at all (service-role / admin client from the
  -- cron). The cron invokes with the service-role key and
  -- auth.uid() is NULL in that case, so we let it pass.
  -- ------------------------------------------------------------
  IF v_caller_uid IS NOT NULL THEN
    SELECT ip.id INTO v_instructor_profile
    FROM public.instructor_profiles ip
    WHERE ip.user_id = v_caller_uid
      AND ip.approval_status = 'approved';

    IF v_instructor_profile IS NULL
       OR v_instructor_profile <> v_session.instructor_id THEN
      RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ------------------------------------------------------------
  -- Flip the session. Both status and quorum_state.
  -- ------------------------------------------------------------
  UPDATE public.activity_sessions
  SET status = 'cancelled',
      quorum_state = 'cancelled',
      updated_at = now()
  WHERE id = p_session_id;

  -- ------------------------------------------------------------
  -- Refund every non-cancelled booking on this session. Full amount.
  -- ------------------------------------------------------------
  FOR v_booking IN
    SELECT id, user_id, total_price_cents
    FROM public.bookings
    WHERE session_id = p_session_id
      AND status <> 'cancelled'
  LOOP
    UPDATE public.bookings
    SET status = 'cancelled',
        payment_status = 'refunded',
        refund_amount_cents = total_price_cents,
        cancelled_at = now()
    WHERE id = v_booking.id;

    v_body := CASE p_reason
      WHEN 'quorum_not_met' THEN
        format(
          'A sessão de "%s" foi cancelada porque não atingiu o mínimo de participantes. Seu pagamento foi reembolsado integralmente.',
          v_session.title_pt
        )
      ELSE
        format(
          'A sessão de "%s" foi cancelada pelo instrutor. Seu pagamento foi reembolsado integralmente.',
          v_session.title_pt
        )
    END;

    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      v_booking.user_id,
      'booking_cancelled',
      'Sessão cancelada',
      v_body,
      'in_app'
    );

    v_affected := v_affected + 1;
  END LOOP;

  RETURN v_affected;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_session_with_refunds(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_session_with_refunds(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_session_with_refunds(UUID, TEXT) TO service_role;

COMMIT;
```

- [ ] **Step 4: Apply the migration**

Run: `supabase db reset` (from the hobby-marketplace dir).

Expected: completes without errors.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/integration/cancel-session-rpc.test.ts -v`

Expected: all 3 cases pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/00029_cancel_session_rpc.sql __tests__/integration/cancel-session-rpc.test.ts
git commit -m "feat(db): add cancel_session_with_refunds RPC"
```

---

## Task 3: Quorum RPCs — confirm, evaluate, expire + auto-confirm on booking

**Files:**
- Create: `supabase/migrations/00030_quorum_rpcs.sql`
- Test: `__tests__/integration/quorum-rpcs.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `__tests__/integration/quorum-rpcs.test.ts`:

```ts
/** @jest-environment node */

import {
  loadEnvLocal,
  serviceClient,
  authenticatedClient,
  seedActivity,
  cleanup,
} from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

loadEnvLocal();
const svc = serviceClient();

const STUDENT_ID = "30000000-0000-0000-0000-000000000001"; // ana
const STUDENT_EMAIL = "ana@example.com";
const INSTRUCTOR_PROFILE_ID = "40000000-0000-0000-0000-000000000001";

const ACTIVITY_ID = "bbbbbb04-0000-0000-0000-000000000001";

async function seedSession(startsAtMs: number, seatsRemaining = 10, maxSeats = 10) {
  const startsAt = new Date(startsAtMs).toISOString();
  const endsAt = new Date(startsAtMs + 2 * 3600 * 1000).toISOString();
  const { data, error } = await svc
    .from("activity_sessions")
    .insert({
      activity_id: ACTIVITY_ID,
      starts_at: startsAt,
      ends_at: endsAt,
      max_seats: maxSeats,
      seats_remaining: seatsRemaining,
      status: "published",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

beforeAll(async () => {
  await seedActivity(svc, ACTIVITY_ID, INSTRUCTOR_PROFILE_ID, {
    max_seats: 10,
    seats_remaining: 10,
    price_cents: 10000,
  });
  // Set the activity's minimum to 5. The seed helper defaults to 0.
  await svc.from("activities").update({ min_participants: 5 }).eq("id", ACTIVITY_ID);
});

afterAll(async () => {
  await svc.from("notifications").delete().in("type", [
    "session_quorum_at_risk",
    "session_confirmed",
    "booking_cancelled",
  ]);
  await cleanup(svc, "activities", [ACTIVITY_ID]);
});

describe("evaluate_session_quorum", () => {
  it("flips a sub-min session in the 22-26h window to at_risk and notifies the instructor", async () => {
    const sid = await seedSession(Date.now() + 24 * 3600 * 1000, 8); // 2 booked, min 5
    // Simulate 2 bookings by directly setting seats_remaining; the RPC
    // derives booked from (max_seats - seats_remaining).

    const { error } = await svc.rpc("evaluate_session_quorum");
    expect(error).toBeNull();

    const { data: s } = await svc
      .from("activity_sessions")
      .select("quorum_state, quorum_evaluated_at")
      .eq("id", sid)
      .single();
    expect(s!.quorum_state).toBe("at_risk");
    expect(s!.quorum_evaluated_at).not.toBeNull();

    await svc.from("activity_sessions").delete().eq("id", sid);
  });

  it("leaves a session already at/above min in 'pending' (auto-confirm path handles confirmation)", async () => {
    const sid = await seedSession(Date.now() + 24 * 3600 * 1000, 5); // 5 booked, min 5

    await svc.rpc("evaluate_session_quorum");

    const { data: s } = await svc
      .from("activity_sessions")
      .select("quorum_state")
      .eq("id", sid)
      .single();
    expect(s!.quorum_state).toBe("pending");

    await svc.from("activity_sessions").delete().eq("id", sid);
  });

  it("does not touch sessions outside the 22-26h window", async () => {
    const early = await seedSession(Date.now() + 48 * 3600 * 1000, 8); // too far out
    const late = await seedSession(Date.now() + 2 * 3600 * 1000, 8); // too close

    await svc.rpc("evaluate_session_quorum");

    const { data: rows } = await svc
      .from("activity_sessions")
      .select("id, quorum_state")
      .in("id", [early, late]);
    expect(rows!.every((r) => r.quorum_state === "pending")).toBe(true);

    await svc.from("activity_sessions").delete().in("id", [early, late]);
  });
});

describe("confirm_session_quorum", () => {
  it("flips at_risk → confirmed, stamps instructor_confirmed_at, notifies booked participants", async () => {
    const sid = await seedSession(Date.now() + 24 * 3600 * 1000, 8);
    // Book 2 seats as the student.
    await svc.rpc("book_session_from_webhook", {
      p_user_id: STUDENT_ID,
      p_session_id: sid,
      p_seats: 2,
      p_stripe_session_id: `cs_test_quorum_confirm_${Date.now()}`,
    });

    // Move it to at_risk manually to isolate confirm behavior.
    await svc
      .from("activity_sessions")
      .update({ quorum_state: "at_risk", quorum_evaluated_at: new Date().toISOString() })
      .eq("id", sid);

    const instructor = await authenticatedClient("mariana@example.com");
    const { error } = await instructor.rpc("confirm_session_quorum", { p_session_id: sid });
    expect(error).toBeNull();

    const { data: s } = await svc
      .from("activity_sessions")
      .select("quorum_state, instructor_confirmed_at")
      .eq("id", sid)
      .single();
    expect(s!.quorum_state).toBe("confirmed");
    expect(s!.instructor_confirmed_at).not.toBeNull();

    const { data: notifs } = await svc
      .from("notifications")
      .select("type")
      .eq("user_id", STUDENT_ID)
      .eq("type", "session_confirmed");
    expect(notifs!.length).toBeGreaterThanOrEqual(1);

    await svc.from("bookings").delete().eq("session_id", sid);
    await svc.from("activity_sessions").delete().eq("id", sid);
  });

  it("rejects a session not currently at_risk", async () => {
    const sid = await seedSession(Date.now() + 24 * 3600 * 1000, 8);
    const instructor = await authenticatedClient("mariana@example.com");
    const { error } = await instructor.rpc("confirm_session_quorum", { p_session_id: sid });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not_at_risk|already_cancelled|already_confirmed/i);
    await svc.from("activity_sessions").delete().eq("id", sid);
  });
});

describe("expire_at_risk_sessions", () => {
  it("cancels at_risk sessions past the 2h window with no instructor_confirmed_at", async () => {
    const sid = await seedSession(Date.now() + 22 * 3600 * 1000, 8);
    // Book 2 seats so we can assert the cancel refund path runs.
    await svc.rpc("book_session_from_webhook", {
      p_user_id: STUDENT_ID,
      p_session_id: sid,
      p_seats: 2,
      p_stripe_session_id: `cs_test_quorum_expire_${Date.now()}`,
    });
    // Pretend evaluate ran >2h ago.
    await svc
      .from("activity_sessions")
      .update({
        quorum_state: "at_risk",
        quorum_evaluated_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      })
      .eq("id", sid);

    const { error } = await svc.rpc("expire_at_risk_sessions");
    expect(error).toBeNull();

    const { data: s } = await svc
      .from("activity_sessions")
      .select("status, quorum_state")
      .eq("id", sid)
      .single();
    expect(s!.status).toBe("cancelled");
    expect(s!.quorum_state).toBe("cancelled");

    const { data: b } = await svc
      .from("bookings")
      .select("status, payment_status")
      .eq("session_id", sid);
    expect(b!.every((row) => row.status === "cancelled" && row.payment_status === "refunded")).toBe(true);

    await svc.from("bookings").delete().eq("session_id", sid);
    await svc.from("activity_sessions").delete().eq("id", sid);
  });

  it("skips at_risk sessions still inside the 2h window", async () => {
    const sid = await seedSession(Date.now() + 22 * 3600 * 1000, 8);
    await svc
      .from("activity_sessions")
      .update({
        quorum_state: "at_risk",
        quorum_evaluated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      })
      .eq("id", sid);

    await svc.rpc("expire_at_risk_sessions");

    const { data: s } = await svc
      .from("activity_sessions")
      .select("quorum_state")
      .eq("id", sid)
      .single();
    expect(s!.quorum_state).toBe("at_risk");

    await svc.from("activity_sessions").delete().eq("id", sid);
  });
});

describe("book_session auto-confirm", () => {
  it("flips quorum_state to confirmed when a booking crosses min_participants", async () => {
    // 9 seats remaining, min 5 — one more booking of 4 tips it over (5 booked total).
    const sid = await seedSession(Date.now() + 48 * 3600 * 1000, 9);
    const client = await authenticatedClient(STUDENT_EMAIL);

    const { error } = await client.rpc("book_session", {
      p_user_id: STUDENT_ID,
      p_session_id: sid,
      p_seats: 4,
    });
    expect(error).toBeNull();

    const { data: s } = await svc
      .from("activity_sessions")
      .select("quorum_state")
      .eq("id", sid)
      .single();
    expect(s!.quorum_state).toBe("confirmed");

    const { data: notifs } = await svc
      .from("notifications")
      .select("type")
      .eq("user_id", STUDENT_ID)
      .eq("type", "session_confirmed");
    expect(notifs!.length).toBeGreaterThanOrEqual(1);

    await svc.from("bookings").delete().eq("session_id", sid);
    await svc.from("activity_sessions").delete().eq("id", sid);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/integration/quorum-rpcs.test.ts -v`

Expected: FAIL with `Could not find the function public.evaluate_session_quorum`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/00030_quorum_rpcs.sql`:

```sql
-- ============================================================
-- Phase 12: quorum RPCs.
--
-- Four RPCs:
--   1. confirm_session_quorum(session_id) — instructor override
--      flips at_risk → confirmed
--   2. evaluate_session_quorum() — cron job: finds sub-min
--      sessions in the 22-26h window, flips to at_risk, notifies
--      instructor
--   3. expire_at_risk_sessions() — cron job: finds at_risk
--      sessions past the 2h confirmation window, delegates to
--      cancel_session_with_refunds (shared code path)
--
-- Plus amendments to book_session and book_session_from_webhook
-- so that when a booking takes booked-seats >= min_participants,
-- quorum_state flips to 'confirmed' and every existing booking
-- on the session receives a session_confirmed notification.
-- ============================================================

BEGIN;

-- --------------------------------------------------------------
-- confirm_session_quorum(session_id)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_session_quorum(
  p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid   UUID := auth.uid();
  v_profile_id   UUID;
  v_session      RECORD;
  v_booking      RECORD;
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT ip.id INTO v_profile_id
  FROM public.instructor_profiles ip
  WHERE ip.user_id = v_caller_uid
    AND ip.approval_status = 'approved';

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT s.id, s.activity_id, s.quorum_state,
         COALESCE(a.title->>'pt', 'atividade') AS title_pt,
         a.instructor_id
  INTO v_session
  FROM public.activity_sessions s
  JOIN public.activities a ON a.id = s.activity_id
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.instructor_id <> v_profile_id THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF v_session.quorum_state = 'confirmed' THEN
    RAISE EXCEPTION 'already_confirmed' USING ERRCODE = 'P0001';
  END IF;

  IF v_session.quorum_state = 'cancelled' THEN
    RAISE EXCEPTION 'already_cancelled' USING ERRCODE = 'P0001';
  END IF;

  IF v_session.quorum_state <> 'at_risk' THEN
    RAISE EXCEPTION 'not_at_risk' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.activity_sessions
  SET quorum_state = 'confirmed',
      instructor_confirmed_at = now(),
      updated_at = now()
  WHERE id = p_session_id;

  -- Notify each booked participant.
  FOR v_booking IN
    SELECT user_id
    FROM public.bookings
    WHERE session_id = p_session_id
      AND status <> 'cancelled'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      v_booking.user_id,
      'session_confirmed',
      'Aula confirmada',
      format(
        'Boa notícia! A sessão de "%s" foi confirmada. Até lá!',
        v_session.title_pt
      ),
      'in_app'
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_session_quorum(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_session_quorum(UUID) TO authenticated;

-- --------------------------------------------------------------
-- evaluate_session_quorum()
--
-- Runs hourly via /api/cron/hourly. Returns the set of instructor
-- user ids that got a new notification, so the route can drain
-- emails for them.
--
-- The 22-26h window is intentionally wider than 24h: a delayed
-- cron run still catches its sessions. `quorum_state = 'pending'`
-- prevents double-flipping on the next run.
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_session_quorum()
RETURNS TABLE(affected_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH flagged AS (
    UPDATE public.activity_sessions s
    SET quorum_state = 'at_risk',
        quorum_evaluated_at = now(),
        updated_at = now()
    FROM public.activities a
    WHERE s.activity_id = a.id
      AND s.quorum_state = 'pending'
      AND s.status = 'published'
      AND a.min_participants > 0
      AND (s.max_seats - s.seats_remaining) < a.min_participants
      AND s.starts_at BETWEEN now() + INTERVAL '22 hours' AND now() + INTERVAL '26 hours'
    RETURNING s.id AS session_id,
              s.activity_id,
              s.starts_at,
              s.max_seats,
              s.seats_remaining,
              a.instructor_id,
              a.min_participants,
              COALESCE(a.title->>'pt', 'atividade') AS title_pt
  ),
  instructor_lookup AS (
    SELECT f.session_id, f.starts_at, f.max_seats, f.seats_remaining,
           f.min_participants, f.title_pt, ip.user_id AS instructor_user_id
    FROM flagged f
    JOIN public.instructor_profiles ip ON ip.id = f.instructor_id
  ),
  inserted AS (
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    SELECT
      il.instructor_user_id,
      'session_quorum_at_risk',
      'Sessão abaixo do mínimo',
      format(
        'A sessão de "%s" está abaixo do mínimo: %s/%s participantes. Confirme que vai rodar dentro de 2h, caso contrário ela será cancelada automaticamente.',
        il.title_pt,
        il.max_seats - il.seats_remaining,
        il.min_participants
      ),
      'in_app'
    FROM instructor_lookup il
    RETURNING user_id
  )
  SELECT DISTINCT user_id FROM inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_session_quorum() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_session_quorum() TO service_role;

-- --------------------------------------------------------------
-- expire_at_risk_sessions()
--
-- For each at_risk session past the 2h confirmation window with
-- no instructor override, call cancel_session_with_refunds.
-- Returns the set of user ids that got booking_cancelled
-- notifications so the route can drain emails.
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_at_risk_sessions()
RETURNS TABLE(affected_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Cancel each expired session one by one. Collecting affected
  -- user ids across iterations is awkward in plpgsql; we query
  -- notifications afterward instead.
  FOR v_session_id IN
    SELECT id
    FROM public.activity_sessions
    WHERE quorum_state = 'at_risk'
      AND instructor_confirmed_at IS NULL
      AND quorum_evaluated_at + INTERVAL '2 hours' <= now()
      AND starts_at > now()  -- don't retroactively cancel past sessions
  LOOP
    PERFORM public.cancel_session_with_refunds(v_session_id, 'quorum_not_met');
  END LOOP;

  -- Anyone who received a booking_cancelled notification in the
  -- last minute is a candidate to email. This is a slight over-
  -- fetch (picks up instructor-initiated cancels too, if any
  -- happen concurrently) but the email dispatcher dedupes and
  -- filters by notification preferences.
  RETURN QUERY
  SELECT DISTINCT user_id
  FROM public.notifications
  WHERE type = 'booking_cancelled'
    AND created_at > now() - INTERVAL '1 minute';
END;
$$;

REVOKE ALL ON FUNCTION public.expire_at_risk_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_at_risk_sessions() TO service_role;

-- --------------------------------------------------------------
-- Amend book_session + book_session_from_webhook for auto-confirm.
--
-- Both RPCs already decrement seats_remaining. We add a tail step:
-- if the session's activity has a min and booked (= max - remaining)
-- now meets or exceeds it, flip quorum_state and notify every
-- already-booked participant.
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maybe_auto_confirm_quorum(
  p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_info    RECORD;
  v_booking RECORD;
BEGIN
  SELECT s.id, s.quorum_state, s.max_seats, s.seats_remaining,
         a.min_participants,
         COALESCE(a.title->>'pt', 'atividade') AS title_pt
  INTO v_info
  FROM public.activity_sessions s
  JOIN public.activities a ON a.id = s.activity_id
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_info.min_participants = 0 THEN
    RETURN;
  END IF;

  -- Only flip from pending/at_risk; never un-cancel or re-confirm.
  IF v_info.quorum_state NOT IN ('pending', 'at_risk') THEN
    RETURN;
  END IF;

  IF (v_info.max_seats - v_info.seats_remaining) < v_info.min_participants THEN
    RETURN;
  END IF;

  UPDATE public.activity_sessions
  SET quorum_state = 'confirmed',
      updated_at = now()
  WHERE id = p_session_id;

  FOR v_booking IN
    SELECT user_id
    FROM public.bookings
    WHERE session_id = p_session_id
      AND status <> 'cancelled'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, channel)
    VALUES (
      v_booking.user_id,
      'session_confirmed',
      'Aula confirmada',
      format(
        'Boa notícia! A sessão de "%s" foi confirmada. Até lá!',
        v_info.title_pt
      ),
      'in_app'
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_auto_confirm_quorum(UUID) FROM PUBLIC;
-- Called only from other SECURITY DEFINER functions; no grants needed.

-- Re-declare book_session with a PERFORM at the tail. The body up
-- to the INSERT is identical to 00022_book_session_rpcs.sql; we
-- replace the whole function so callers see one atomic version.
CREATE OR REPLACE FUNCTION public.book_session(
  p_user_id    uuid,
  p_session_id uuid,
  p_seats      integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session             record;
  v_activity            record;
  v_total_price         integer;
  v_booking_id          uuid;
  v_instructor_user_id  uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be >= 1' USING ERRCODE = '22023';
  END IF;

  SELECT id, activity_id, starts_at, seats_remaining, status
  INTO v_session
  FROM public.activity_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status <> 'published' THEN
    RAISE EXCEPTION 'session is not bookable' USING ERRCODE = '22023';
  END IF;

  IF v_session.starts_at < now() THEN
    RAISE EXCEPTION 'session has already started' USING ERRCODE = '22023';
  END IF;

  IF v_session.seats_remaining < p_seats THEN
    RAISE EXCEPTION 'not enough seats remaining' USING ERRCODE = '22023';
  END IF;

  SELECT id, price_cents, status, instructor_id
  INTO v_activity
  FROM public.activities
  WHERE id = v_session.activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_activity.status <> 'published' THEN
    RAISE EXCEPTION 'activity is not bookable' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_instructor_user_id
  FROM public.instructor_profiles
  WHERE id = v_activity.instructor_id;

  IF v_instructor_user_id = p_user_id THEN
    RAISE EXCEPTION 'cannot book your own activity' USING ERRCODE = '22023';
  END IF;

  v_total_price := v_activity.price_cents * p_seats;

  UPDATE public.activity_sessions
  SET seats_remaining = seats_remaining - p_seats
  WHERE id = p_session_id;

  INSERT INTO public.bookings (
    user_id, activity_id, session_id, seats_booked, total_price_cents,
    status, payment_status
  ) VALUES (
    p_user_id, v_session.activity_id, p_session_id, p_seats, v_total_price,
    'confirmed', 'paid'
  )
  RETURNING id INTO v_booking_id;

  -- NEW: auto-confirm quorum if this booking just pushed us over.
  PERFORM public.maybe_auto_confirm_quorum(p_session_id);

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_session(uuid, uuid, integer) TO authenticated;

-- Same amendment for the webhook variant. We reuse the original
-- function text and append the PERFORM before RETURN.
CREATE OR REPLACE FUNCTION public.book_session_from_webhook(
  p_user_id           uuid,
  p_session_id        uuid,
  p_seats             integer,
  p_stripe_session_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session             record;
  v_activity            record;
  v_total_price         integer;
  v_booking_id          uuid;
  v_existing_id         uuid;
  v_instructor_user_id  uuid;
BEGIN
  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be >= 1' USING ERRCODE = '22023';
  END IF;

  IF p_stripe_session_id IS NULL OR length(p_stripe_session_id) = 0 THEN
    RAISE EXCEPTION 'stripe session id required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.bookings
  WHERE stripe_session_id = p_stripe_session_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT id, activity_id, starts_at, seats_remaining, status
  INTO v_session
  FROM public.activity_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status <> 'published' THEN
    RAISE EXCEPTION 'session is not bookable' USING ERRCODE = '22023';
  END IF;

  IF v_session.starts_at < now() THEN
    RAISE EXCEPTION 'session has already started' USING ERRCODE = '22023';
  END IF;

  IF v_session.seats_remaining < p_seats THEN
    RAISE EXCEPTION 'not enough seats remaining' USING ERRCODE = '22023';
  END IF;

  SELECT id, price_cents, status, instructor_id
  INTO v_activity
  FROM public.activities
  WHERE id = v_session.activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_activity.status <> 'published' THEN
    RAISE EXCEPTION 'activity is not bookable' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_instructor_user_id
  FROM public.instructor_profiles
  WHERE id = v_activity.instructor_id;

  IF v_instructor_user_id = p_user_id THEN
    RAISE EXCEPTION 'cannot book your own activity' USING ERRCODE = '22023';
  END IF;

  v_total_price := v_activity.price_cents * p_seats;

  UPDATE public.activity_sessions
  SET seats_remaining = seats_remaining - p_seats
  WHERE id = p_session_id;

  INSERT INTO public.bookings (
    user_id, activity_id, session_id, seats_booked, total_price_cents,
    status, payment_status, stripe_session_id
  ) VALUES (
    p_user_id, v_session.activity_id, p_session_id, p_seats, v_total_price,
    'confirmed', 'paid', p_stripe_session_id
  )
  RETURNING id INTO v_booking_id;

  PERFORM public.maybe_auto_confirm_quorum(p_session_id);

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_session_from_webhook(uuid, uuid, integer, text) TO service_role;

COMMIT;
```

- [ ] **Step 4: Apply the migration**

Run: `supabase db reset`

Expected: completes without errors.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/integration/quorum-rpcs.test.ts -v`

Expected: all cases pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/00030_quorum_rpcs.sql __tests__/integration/quorum-rpcs.test.ts
git commit -m "feat(db): quorum RPCs (evaluate, confirm, expire) + auto-confirm on book"
```

---

## Task 4: TypeScript types + `getQuorumStatus` helper

**Files:**
- Modify: `src/lib/types/database.ts`
- Create: `src/lib/quorum.ts`
- Test: `__tests__/lib/quorum.test.ts`

- [ ] **Step 1: Extend the DB types**

Edit `src/lib/types/database.ts`. Find the `Activity` interface and add `min_participants` after `max_seats`:

```ts
  max_seats: number;
  seats_remaining: number;
  min_participants: number;
```

Find the `ActivitySession` interface and add three fields after `status`:

```ts
  status: ActivityStatus;
  quorum_state: "pending" | "confirmed" | "at_risk" | "cancelled";
  quorum_evaluated_at: string | null;
  instructor_confirmed_at: string | null;
```

- [ ] **Step 2: Write the failing unit test**

Create `__tests__/lib/quorum.test.ts`:

```ts
import { getQuorumStatus } from "@/lib/quorum";

describe("getQuorumStatus", () => {
  it("returns 'none' when min_participants is 0", () => {
    expect(getQuorumStatus(0, 3, "pending")).toEqual({ kind: "none" });
  });

  it("returns 'confirmed' when state is 'confirmed' regardless of booked", () => {
    expect(getQuorumStatus(5, 2, "confirmed")).toEqual({ kind: "confirmed" });
    expect(getQuorumStatus(5, 6, "confirmed")).toEqual({ kind: "confirmed" });
  });

  it("returns 'confirmed' when booked >= min even if state is still pending", () => {
    // The RPC layer is eventually consistent; if booked >= min but
    // the state hasn't flipped yet, we still show confirmed.
    expect(getQuorumStatus(5, 5, "pending")).toEqual({ kind: "confirmed" });
  });

  it("returns 'at_risk' when state is 'at_risk'", () => {
    expect(getQuorumStatus(5, 2, "at_risk")).toEqual({ kind: "at_risk" });
  });

  it("returns 'close' when 1 or 2 spots away from min", () => {
    expect(getQuorumStatus(5, 4, "pending")).toEqual({ kind: "close", needed: 1 });
    expect(getQuorumStatus(5, 3, "pending")).toEqual({ kind: "close", needed: 2 });
  });

  it("returns 'silent' when 3+ away from min", () => {
    expect(getQuorumStatus(5, 2, "pending")).toEqual({ kind: "silent" });
    expect(getQuorumStatus(5, 0, "pending")).toEqual({ kind: "silent" });
  });

  it("returns 'none' when state is 'cancelled' (UI falls back to existing cancelled-path)", () => {
    expect(getQuorumStatus(5, 2, "cancelled")).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/lib/quorum.test.ts`

Expected: FAIL with `Cannot find module '@/lib/quorum'`.

- [ ] **Step 4: Implement `getQuorumStatus`**

Create `src/lib/quorum.ts`:

```ts
/**
 * Quorum status for a time-slot card.
 *
 * The mapping from (min, booked, state) to a badge variant lives
 * here so the UI has exactly one source of truth for which
 * indicator to show. The cards just render whatever this returns.
 *
 * The "silent at 3+ away" threshold is intentional: showing "0/5"
 * or "1/5" on a sparse-looking session creates a self-fulfilling
 * prophecy where the visible emptiness discourages booking. We
 * only surface progress when it's motivating ("only 2 more needed")
 * or informative ("✓ Confirmed").
 */
export type QuorumState = "pending" | "confirmed" | "at_risk" | "cancelled";

export type QuorumStatus =
  | { kind: "none" }
  | { kind: "confirmed" }
  | { kind: "at_risk" }
  | { kind: "close"; needed: number }
  | { kind: "silent" };

export function getQuorumStatus(
  min: number,
  booked: number,
  state: QuorumState
): QuorumStatus {
  // Feature disabled at the activity level, or session already
  // cancelled (UI handles that via the existing cancelled path).
  if (min === 0 || state === "cancelled") return { kind: "none" };

  // Confirmed takes precedence over booked count — once the system
  // or instructor says confirmed, we commit to that message.
  if (state === "confirmed" || booked >= min) return { kind: "confirmed" };

  if (state === "at_risk") return { kind: "at_risk" };

  const needed = min - booked;
  if (needed <= 2) return { kind: "close", needed };
  return { kind: "silent" };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/lib/quorum.test.ts`

Expected: all 7 cases pass.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/database.ts src/lib/quorum.ts __tests__/lib/quorum.test.ts
git commit -m "feat: getQuorumStatus helper + quorum DB types"
```

---

## Task 5: Activity form — min_participants input + validation

**Files:**
- Modify: `src/lib/activity-validation.ts`
- Modify: `src/components/instructor/activity-form.tsx`

- [ ] **Step 1: Extend the validator**

Edit `src/lib/activity-validation.ts`:

Find the `ActivityInput` interface and add the field after `max_seats`:

```ts
  max_seats: number;
  min_participants: number;
```

Find the `ActivityValidationField` union and add:

```ts
  | "max_seats"
  | "min_participants"
```

Find the existing `max_seats` block in `validateActivityInput` and add a new block after it:

```ts
  if (
    !Number.isInteger(input.max_seats) ||
    input.max_seats < 1 ||
    input.max_seats > 50
  ) {
    return { field: "max_seats", message: "Max seats must be between 1 and 50" };
  }
  if (
    !Number.isInteger(input.min_participants) ||
    input.min_participants < 0 ||
    input.min_participants > input.max_seats
  ) {
    return {
      field: "min_participants",
      message: "Minimum participants must be between 0 and max seats",
    };
  }
```

- [ ] **Step 2: Add the form field**

Edit `src/components/instructor/activity-form.tsx`:

Find the initial-state default for `max_seats: 10` (around line 67) and add a sibling:

```ts
    max_seats: 10,
    min_participants: 0,
```

Find the `max_seats` input (around line 472) and add a new block directly below the closing `</div>` of the max_seats field. Match the surrounding Tailwind classes from the max_seats field:

```tsx
<div>
  <label
    htmlFor="min_participants"
    className="block text-sm font-medium text-charcoal mb-1"
  >
    {t("minParticipantsLabel")}
  </label>
  <input
    type="number"
    id="min_participants"
    min={0}
    max={form.max_seats}
    value={form.min_participants}
    onChange={(e) => update("min_participants", Number(e.target.value))}
    className="w-full rounded-md border border-charcoal-lighter/20 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
  />
  <p className="mt-1 text-xs text-charcoal-lighter">
    {t("minParticipantsHint")}
  </p>
</div>
```

(Use whatever translation hook already exists in the file — if it's `t` from `useTranslations("instructor")`, keep that. If it's a different namespace, use the matching one.)

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/activity-validation.ts src/components/instructor/activity-form.tsx
git commit -m "feat(instructor): min_participants input + validation"
```

---

## Task 6: Queries — include quorum fields in session selects

**Files:**
- Modify: `src/lib/queries/activities.ts`

- [ ] **Step 1: Include `min_participants` in activity selects**

Edit `src/lib/queries/activities.ts`:

Find every `.select("...")` call that pulls from `activities` (there are a few — search for `activities"` inside `.from(`). Add `min_participants` to the field list. Specifically, in `fetchActivityById`, `fetchActivities`, and `fetchActivitiesForAdmin`, ensure the activity select includes `min_participants`.

If these selects use `*` they already include it. Verify with:

```bash
grep -n 'select("' src/lib/queries/activities.ts | head -20
```

If the select is explicit rather than `*`, add `min_participants` alongside `max_seats`.

- [ ] **Step 2: Include quorum fields in session embeds**

In the same file, find the two places that embed `activity_sessions`:

```
activity_sessions!inner (
  id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time
)
```

And

```
activity_sessions (id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time)
```

Extend each to include quorum fields:

```
activity_sessions!inner (
  id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time, quorum_state, instructor_confirmed_at
)
```

And:

```
activity_sessions (
  id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time, quorum_state, instructor_confirmed_at
)
```

- [ ] **Step 3: Extend the `ActivitySessionSummary` type**

Still in `src/lib/queries/activities.ts`, find `ActivitySessionSummary` and add two fields (use `QuorumState` from `@/lib/quorum`):

```ts
import type { QuorumState } from "@/lib/quorum";

// ...

export interface ActivitySessionSummary {
  id: string;
  starts_at: string;
  ends_at: string;
  max_seats: number;
  seats_remaining: number;
  status: string;
  quorum_state: QuorumState;
  instructor_confirmed_at: string | null;
}
```

(If the type currently lives elsewhere in the file, edit it in place.)

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no errors. Existing call sites that destructure `ActivitySessionSummary` still work because we added optional-ish new fields.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/activities.ts
git commit -m "feat(queries): include min_participants + quorum_state in activity+session selects"
```

---

## Task 7: Activity detail page — quorum promise line

**Files:**
- Modify: `src/app/[locale]/activities/[id]/page.tsx`
- Modify: `src/components/activities/booking-form.tsx`

- [ ] **Step 1: Pass `minParticipants` to BookingForm**

Edit `src/app/[locale]/activities/[id]/page.tsx`. Find the `<BookingForm ... />` call (around line 277) and add a new prop:

```tsx
<BookingForm
  pricePerSeatCents={activity.price_cents}
  isAuthed={!!currentUser}
  isSoldOut={isSoldOut}
  isOwnActivity={isOwnActivity}
  minParticipants={activity.min_participants}
/>
```

- [ ] **Step 2: Accept the prop in BookingForm and render the promise line**

Edit `src/components/activities/booking-form.tsx`.

Extend the props interface:

```ts
interface BookingFormProps {
  pricePerSeatCents: number;
  isAuthed: boolean;
  isSoldOut: boolean;
  isOwnActivity?: boolean;
  /**
   * Activity's min_participants. 0 means no minimum — no quorum
   * promise line renders. > 0 shows "Mínimo de N participantes —
   * confirmada 24h antes" above the submit button.
   */
  minParticipants: number;
}
```

Update the function signature and destructuring to include `minParticipants`.

Inside the returned `<form>`, directly above the submit `<Button>` and below the agree-checkbox label, add:

```tsx
{minParticipants > 0 && (
  <p className="text-xs text-charcoal-lighter">
    {t("quorumPromise", { min: minParticipants })}
  </p>
)}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/activities/[id]/page.tsx src/components/activities/booking-form.tsx
git commit -m "feat(activity-page): quorum promise line in booking form"
```

---

## Task 8: Session picker — quorum badges on time-slot cards

**Files:**
- Modify: `src/components/activities/booking-flow/session-picker.tsx`
- Modify: `src/components/activities/booking-flow/booking-flow-context.tsx`

- [ ] **Step 1: Pass minParticipants through the context**

Edit `src/components/activities/booking-flow/booking-flow-context.tsx`. Extend the provider props:

```ts
export function BookingFlowProvider({
  sessions,
  minParticipants,
  children,
}: {
  sessions: ActivitySessionSummary[];
  minParticipants: number;
  children: React.ReactNode;
}) {
```

Extend the context value:

```ts
interface BookingFlowValue {
  sessions: ActivitySessionSummary[];
  bookable: ActivitySessionSummary[];
  minParticipants: number;
  selectedSessionId: string | null;
  setSelectedSessionId: (id: string | null) => void;
  selectedSession: ActivitySessionSummary | null;
}
```

And plumb `minParticipants` into the value memo alongside `sessions`, `bookable`, etc.

- [ ] **Step 2: Pass the value from the page**

Edit `src/app/[locale]/activities/[id]/page.tsx`. Update the provider invocation:

```tsx
<BookingFlowProvider
  sessions={activity.activity_sessions ?? []}
  minParticipants={activity.min_participants}
>
```

- [ ] **Step 3: Render the quorum badge in TimeSlotGrid**

Edit `src/components/activities/booking-flow/session-picker.tsx`. Add the import:

```ts
import { getQuorumStatus } from "@/lib/quorum";
```

Pull `minParticipants` from the context at the top of `SessionPicker`:

```ts
const { sessions, selectedSession, setSelectedSessionId, minParticipants } = useBookingFlow();
```

Pass it down to `TimeSlotGrid` via a new prop:

```tsx
<TimeSlotGrid
  sessions={selectedGroup.sessions}
  selectedId={selectedSession?.id ?? null}
  onSelect={setSelectedSessionId}
  locale={locale}
  minParticipants={minParticipants}
/>
```

Update `TimeSlotGrid`'s signature:

```ts
function TimeSlotGrid({
  sessions,
  selectedId,
  onSelect,
  locale,
  minParticipants,
}: {
  sessions: ActivitySessionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  locale: "pt" | "en" | "es";
  minParticipants: number;
}) {
```

Inside the map that renders each time-slot button, compute the quorum status after the existing `const scarce = ...` line:

```ts
const booked = s.max_seats - s.seats_remaining;
const quorum = getQuorumStatus(minParticipants, booked, s.quorum_state);
```

Replace the existing status-line block (the `{isPast ? ... : isSoldOut ? ... : scarce ? ... : <span>{t("available")}</span>}` chain) with a version that gives quorum priority when it has something to say:

```tsx
<div className="text-[11px] font-medium mb-0.5 h-4">
  {isPast ? (
    <span className="text-charcoal-lighter">{t("past")}</span>
  ) : isSoldOut ? (
    <span className="text-charcoal-lighter">{t("soldOut")}</span>
  ) : quorum.kind === "confirmed" ? (
    <span className="text-primary-500">✓ {t("quorumConfirmed")}</span>
  ) : quorum.kind === "at_risk" ? (
    <span className="text-accent-600">{t("quorumAtRisk")}</span>
  ) : quorum.kind === "close" ? (
    <span className="text-primary-500">
      {t("quorumClose", { needed: quorum.needed })}
    </span>
  ) : scarce ? (
    <span className="text-accent-600">
      {formatSeats(s.seats_remaining, locale)}
    </span>
  ) : (
    <span className="text-primary-500">{t("available")}</span>
  )}
</div>
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/activities/booking-flow/booking-flow-context.tsx src/components/activities/booking-flow/session-picker.tsx src/app/[locale]/activities/[id]/page.tsx
git commit -m "feat(picker): quorum badges on time-slot cards"
```

---

## Task 9: Booking confirmation page — "confirmed 24h before" notice

**Files:**
- Modify: `src/app/[locale]/bookings/[id]/confirmation/page.tsx`

- [ ] **Step 1: Query quorum state**

Edit `src/app/[locale]/bookings/[id]/confirmation/page.tsx`. In the booking fetch, include the session's `quorum_state` and the activity's `min_participants`. If the existing query already pulls the activity + session, add these two fields to the select.

- [ ] **Step 2: Render the notice**

After the existing booking-confirmed success UI but before the "view my bookings" CTA, add:

```tsx
{activity.min_participants > 0 && session.quorum_state !== "confirmed" && (
  <div className="mt-4 rounded-md bg-background-muted px-4 py-3 text-sm text-charcoal">
    {t("quorumPostBookingNotice", {
      min: activity.min_participants,
    })}
  </div>
)}
```

(Use the existing page's `t` hook / namespace; match its style.)

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/bookings/[id]/confirmation/page.tsx
git commit -m "feat(confirmation): quorum notice for not-yet-confirmed sessions"
```

---

## Task 10: Server actions — confirm / cancel session

**Files:**
- Modify: `src/lib/actions/sessions.ts`

- [ ] **Step 1: Add `confirmSessionQuorumAction`**

Edit `src/lib/actions/sessions.ts`. Add at the bottom of the file:

```ts
"use server";

// ... existing imports at top ...

/**
 * Instructor override: confirm an at-risk session so it will run
 * even though quorum isn't met. Server-side wrapper around the
 * confirm_session_quorum RPC — the RPC enforces ownership.
 */
export async function confirmSessionQuorumAction(
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_session_quorum", {
    p_session_id: sessionId,
  });
  if (error) {
    // Normalize the common failure modes so the UI can toast them.
    if (error.message.includes("already_confirmed")) {
      return { ok: false, error: "already_confirmed" };
    }
    if (error.message.includes("already_cancelled")) {
      return { ok: false, error: "already_cancelled" };
    }
    if (error.message.includes("not_at_risk")) {
      return { ok: false, error: "not_at_risk" };
    }
    if (error.message.includes("not_authorized")) {
      return { ok: false, error: "not_authorized" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Instructor-initiated cancel of a single session. Reason is
 * 'instructor_cancelled' by default — quorum auto-cancel uses a
 * different reason and calls the RPC directly from the cron.
 */
export async function cancelSessionAction(
  sessionId: string
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_session_with_refunds", {
    p_session_id: sessionId,
    p_reason: "instructor_cancelled",
  });
  if (error) {
    if (error.message.includes("session_already_cancelled")) {
      return { ok: false, error: "already_cancelled" };
    }
    if (error.message.includes("not_authorized")) {
      return { ok: false, error: "not_authorized" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, affected: (data as number) ?? 0 };
}
```

(If `createClient` is not the standard helper in this file, match whatever the file already uses — `createServerClient`, `getSupabaseServer`, etc.)

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/sessions.ts
git commit -m "feat(actions): confirm/cancel session server actions"
```

---

## Task 11: Instructor dashboard — "Precisa de atenção" card

**Files:**
- Modify: `src/app/[locale]/instructor/page.tsx`
- Create: `src/components/instructor/at-risk-sessions-card.tsx`

- [ ] **Step 1: Create the card component**

Create `src/components/instructor/at-risk-sessions-card.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  confirmSessionQuorumAction,
  cancelSessionAction,
} from "@/lib/actions/sessions";

export interface AtRiskSession {
  sessionId: string;
  activityTitle: string;
  startsAt: string;
  booked: number;
  minParticipants: number;
}

/**
 * Surfaces sessions in `quorum_state = 'at_risk'` on the instructor
 * dashboard. Two actions per row: Confirm (proceeds with however many
 * signed up) or Cancel (full refunds to everyone). The card itself
 * is client-side so the actions can update the list optimistically;
 * the parent page does the server-side fetch and passes initial data.
 */
export function AtRiskSessionsCard({
  initialSessions,
}: {
  initialSessions: AtRiskSession[];
}) {
  const t = useTranslations("instructor");
  const locale = useLocale() as "pt" | "en" | "es";
  const [sessions, setSessions] = useState(initialSessions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (sessions.length === 0) return null;

  function handleConfirm(sessionId: string) {
    setPendingId(sessionId);
    startTransition(async () => {
      const res = await confirmSessionQuorumAction(sessionId);
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      }
      setPendingId(null);
    });
  }

  function handleCancel(sessionId: string) {
    if (!confirm(t("atRiskConfirmCancel"))) return;
    setPendingId(sessionId);
    startTransition(async () => {
      const res = await cancelSessionAction(sessionId);
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      }
      setPendingId(null);
    });
  }

  return (
    <div className="rounded-lg border border-accent-300 bg-accent-50 p-5">
      <h2 className="text-lg font-semibold text-charcoal mb-3">
        ⚠ {t("atRiskCardTitle", { count: sessions.length })}
      </h2>
      <ul className="space-y-3">
        {sessions.map((s) => (
          <li
            key={s.sessionId}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md bg-white p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-charcoal truncate">
                {s.activityTitle}
              </p>
              <p className="text-xs text-charcoal-lighter">
                {formatSessionDate(s.startsAt, locale)} ·{" "}
                {t("atRiskParticipants", {
                  booked: s.booked,
                  min: s.minParticipants,
                })}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                disabled={isPending && pendingId === s.sessionId}
                onClick={() => handleConfirm(s.sessionId)}
              >
                {t("atRiskConfirm")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending && pendingId === s.sessionId}
                onClick={() => handleCancel(s.sessionId)}
              >
                {t("atRiskCancel")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatSessionDate(iso: string, locale: "pt" | "en" | "es"): string {
  const localeMap = { pt: "pt-BR", en: "en-US", es: "es-ES" } as const;
  const d = new Date(iso);
  const date = d.toLocaleDateString(localeMap[locale], {
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
  const time = d.toLocaleTimeString(localeMap[locale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${date} · ${time}`;
}
```

- [ ] **Step 2: Fetch at-risk sessions in the instructor page**

Edit `src/app/[locale]/instructor/page.tsx`. Add to the existing server-side data fetch:

```ts
// Pull sessions currently in at_risk state owned by this instructor.
const { data: atRisk } = await supabase
  .from("activity_sessions")
  .select(
    `
    id,
    starts_at,
    max_seats,
    seats_remaining,
    activities!inner (
      id,
      instructor_id,
      min_participants,
      title
    )
  `
  )
  .eq("quorum_state", "at_risk")
  .eq("activities.instructor_id", instructorProfile.id)
  .gt("starts_at", new Date().toISOString())
  .order("starts_at", { ascending: true });

const atRiskSessions: AtRiskSession[] = (atRisk ?? []).map((row: any) => ({
  sessionId: row.id,
  activityTitle:
    (row.activities.title as Record<string, string>)[locale] ??
    (row.activities.title as Record<string, string>).pt,
  startsAt: row.starts_at,
  booked: row.max_seats - row.seats_remaining,
  minParticipants: row.activities.min_participants,
}));
```

Import the card:

```ts
import { AtRiskSessionsCard, type AtRiskSession } from "@/components/instructor/at-risk-sessions-card";
```

Render it at the very top of the page body, above the existing content:

```tsx
<AtRiskSessionsCard initialSessions={atRiskSessions} />
```

(The component returns null when the list is empty, so unconditional rendering is fine.)

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/instructor/at-risk-sessions-card.tsx src/app/[locale]/instructor/page.tsx
git commit -m "feat(instructor): at-risk sessions card on dashboard"
```

---

## Task 12: Email templates — session-quorum-at-risk + session-confirmed

**Files:**
- Create: `src/lib/email/templates/session-quorum-at-risk.ts`
- Create: `src/lib/email/templates/session-confirmed.ts`
- Modify: `src/lib/notifications/dispatch-emails.ts`

- [ ] **Step 1: Inspect existing template shape**

Run:

```bash
ls src/lib/email/templates/ 2>/dev/null && cat src/lib/email/templates/booking-cancelled.ts 2>/dev/null | head -30
```

Expected: one existing template to mirror. If the directory doesn't exist, check where `dispatch-emails.ts` imports its templates from and match that location.

- [ ] **Step 2: Write the two templates**

Create each template mirroring the existing structure (subject + HTML + text). Example shape the templates should follow — adjust function signature to match other templates in the project:

`src/lib/email/templates/session-quorum-at-risk.ts`:

```ts
export interface SessionQuorumAtRiskVars {
  instructorName: string;
  activityTitle: string;
  sessionDate: string;
  booked: number;
  min: number;
  dashboardUrl: string;
}

export function sessionQuorumAtRiskEmail(vars: SessionQuorumAtRiskVars) {
  const { instructorName, activityTitle, sessionDate, booked, min, dashboardUrl } = vars;
  return {
    subject: `Sessão abaixo do mínimo: ${activityTitle}`,
    text: [
      `Olá ${instructorName},`,
      ``,
      `A sessão de "${activityTitle}" em ${sessionDate} está abaixo do mínimo: ${booked}/${min} participantes.`,
      ``,
      `Você tem 2 horas para confirmar que vai rodar. Se não confirmar, a sessão será cancelada automaticamente e os participantes serão reembolsados.`,
      ``,
      `Acesse: ${dashboardUrl}`,
    ].join("\n"),
    html: `
      <p>Olá ${instructorName},</p>
      <p>A sessão de <strong>${activityTitle}</strong> em ${sessionDate} está abaixo do mínimo: ${booked}/${min} participantes.</p>
      <p>Você tem 2 horas para confirmar que vai rodar. Se não confirmar, a sessão será cancelada automaticamente e os participantes serão reembolsados.</p>
      <p><a href="${dashboardUrl}">Ir para o painel</a></p>
    `,
  };
}
```

`src/lib/email/templates/session-confirmed.ts`:

```ts
export interface SessionConfirmedVars {
  participantName: string;
  activityTitle: string;
  sessionDate: string;
}

export function sessionConfirmedEmail(vars: SessionConfirmedVars) {
  const { participantName, activityTitle, sessionDate } = vars;
  return {
    subject: `Sua aula foi confirmada: ${activityTitle}`,
    text: [
      `Olá ${participantName},`,
      ``,
      `Boa notícia! A sessão de "${activityTitle}" em ${sessionDate} foi confirmada. Até lá!`,
    ].join("\n"),
    html: `
      <p>Olá ${participantName},</p>
      <p>Boa notícia! A sessão de <strong>${activityTitle}</strong> em ${sessionDate} foi confirmada. Até lá!</p>
    `,
  };
}
```

- [ ] **Step 3: Register both types in the dispatcher**

Edit `src/lib/notifications/dispatch-emails.ts`. Find the dispatcher's switch/map over `notification_type` and add the two new cases. The exact shape depends on the existing dispatcher — follow the pattern of an existing case like `booking_cancelled`.

Rough sketch (adapt to actual dispatcher shape):

```ts
import { sessionQuorumAtRiskEmail } from "@/lib/email/templates/session-quorum-at-risk";
import { sessionConfirmedEmail } from "@/lib/email/templates/session-confirmed";

// ... inside the dispatch switch ...
case "session_quorum_at_risk":
  return sessionQuorumAtRiskEmail({ /* pull from notification + related rows */ });
case "session_confirmed":
  return sessionConfirmedEmail({ /* pull from notification + related rows */ });
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates/session-quorum-at-risk.ts src/lib/email/templates/session-confirmed.ts src/lib/notifications/dispatch-emails.ts
git commit -m "feat(email): at-risk + session-confirmed templates"
```

---

## Task 13: Hourly cron endpoint

**Files:**
- Create: `src/app/api/cron/hourly/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Write the route**

Create `src/app/api/cron/hourly/route.ts`:

```ts
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

  // Drain email for every affected user, deduped.
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
```

- [ ] **Step 2: Register the cron in vercel.json**

Create `vercel.json` at the repo root:

```json
{
  "crons": [
    {
      "path": "/api/cron/hourly",
      "schedule": "0 * * * *"
    }
  ]
}
```

(If `vercel.json` already exists by this task, merge the entry into the existing `crons` array instead of creating a new file.)

- [ ] **Step 3: Smoke-test locally**

Run the dev server and curl the endpoint with the secret:

```bash
CRON_SECRET=$(grep -E '^CRON_SECRET' .env.local | cut -d= -f2)
curl -i -X POST http://localhost:3000/api/cron/hourly \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: `HTTP/1.1 200 OK` with `{"ok":true, "atRiskFlagged":0, "expiredCancelled":0}` when there's no at-risk data.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/hourly/route.ts vercel.json
git commit -m "feat(cron): hourly quorum evaluation endpoint"
```

---

## Task 14: Translation keys

**Files:**
- Modify: `src/messages/pt.json`
- Modify: `src/messages/en.json`
- Modify: `src/messages/es.json`

- [ ] **Step 1: Add `booking.quorumPromise` to all three**

In each of `pt.json`, `en.json`, `es.json`, add inside the `"booking"` namespace (wherever the existing booking keys live):

**pt:**
```json
"quorumPromise": "Mínimo de {min} participantes — confirmada 24h antes. Reembolso integral se não atingir.",
"quorumPostBookingNotice": "Esta aula é confirmada 24h antes. Se o mínimo de {min} participantes não for atingido, sua reserva é cancelada e o reembolso acontece automaticamente."
```

**en:**
```json
"quorumPromise": "Minimum {min} participants — confirmed 24h before. Full refund if not met.",
"quorumPostBookingNotice": "This class is confirmed 24h before. If the minimum of {min} participants isn't met, your booking is cancelled and the refund is automatic."
```

**es:**
```json
"quorumPromise": "Mínimo de {min} participantes — confirmada 24h antes. Reembolso total si no se alcanza.",
"quorumPostBookingNotice": "Esta clase se confirma 24h antes. Si no se alcanza el mínimo de {min} participantes, tu reserva se cancela y el reembolso es automático."
```

- [ ] **Step 2: Add `activities.quorumConfirmed`, `quorumAtRisk`, `quorumClose`**

Inside the `"activities"` namespace:

**pt:**
```json
"quorumConfirmed": "Confirmada",
"quorumAtRisk": "Aguardando confirmação",
"quorumClose": "Faltam {needed} para confirmar"
```

**en:**
```json
"quorumConfirmed": "Confirmed",
"quorumAtRisk": "Awaiting confirmation",
"quorumClose": "{needed} more to confirm"
```

**es:**
```json
"quorumConfirmed": "Confirmada",
"quorumAtRisk": "Esperando confirmación",
"quorumClose": "Faltan {needed} para confirmar"
```

- [ ] **Step 3: Add instructor-form keys**

Inside the `"instructor"` namespace (create it if missing — check where activity-form.tsx's `t` hook lives):

**pt:**
```json
"minParticipantsLabel": "Mínimo de participantes (opcional)",
"minParticipantsHint": "A sessão é cancelada automaticamente 24h antes se não atingir este número. Deixe em 0 para não definir um mínimo.",
"atRiskCardTitle": "{count, plural, one {# sessão precisa de decisão} other {# sessões precisam de decisão}}",
"atRiskParticipants": "{booked}/{min} participantes",
"atRiskConfirm": "Confirmar — vou rodar",
"atRiskCancel": "Cancelar",
"atRiskConfirmCancel": "Tem certeza? Todos os participantes serão reembolsados integralmente."
```

**en:**
```json
"minParticipantsLabel": "Minimum participants (optional)",
"minParticipantsHint": "The session auto-cancels 24h before if it doesn't reach this number. Leave at 0 for no minimum.",
"atRiskCardTitle": "{count, plural, one {# session needs a decision} other {# sessions need a decision}}",
"atRiskParticipants": "{booked}/{min} participants",
"atRiskConfirm": "Confirm — I'll run it",
"atRiskCancel": "Cancel",
"atRiskConfirmCancel": "Are you sure? All participants will be refunded in full."
```

**es:**
```json
"minParticipantsLabel": "Mínimo de participantes (opcional)",
"minParticipantsHint": "La sesión se cancela automáticamente 24h antes si no alcanza este número. Deja en 0 para no fijar mínimo.",
"atRiskCardTitle": "{count, plural, one {# sesión necesita decisión} other {# sesiones necesitan decisión}}",
"atRiskParticipants": "{booked}/{min} participantes",
"atRiskConfirm": "Confirmar — voy a darla",
"atRiskCancel": "Cancelar",
"atRiskConfirmCancel": "¿Seguro? Todos los participantes serán reembolsados en su totalidad."
```

- [ ] **Step 4: Run typecheck and verify JSON parses**

Run: `npx tsc --noEmit`

Expected: no errors. If next-intl surfaces any missing-key warnings during dev that's fine — no hard fail.

- [ ] **Step 5: Commit**

```bash
git add src/messages/pt.json src/messages/en.json src/messages/es.json
git commit -m "feat(i18n): quorum translation keys across pt/en/es"
```

---

## Task 15: End-to-end sanity check

**Files:** none

- [ ] **Step 1: Full test run**

Run:

```bash
npx jest
```

Expected: all tests pass (existing + new).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Manual smoke**

Run `npm run dev` and:

1. As instructor `mariana@example.com`, edit an activity and set min_participants to 5. Save.
2. As student `ana@example.com`, open the activity detail page. Verify:
   - "Mínimo de 5 participantes — confirmada 24h antes" line appears above the submit button.
   - Time-slot cards show either ✓ Confirmada (if ≥5 booked), "Faltam N" (if 1-2 short), or nothing new (if 3+ short).
3. Book a session to tip one over the minimum. Refresh: that time slot should show ✓ Confirmada.
4. Curl the hourly cron with the secret — should return 200 and no errors.
5. Seed a session 23h from now with booked < min via psql, curl cron — verify session flips to at_risk and an entry appears on the instructor dashboard's "Precisa de atenção" card.

- [ ] **Step 4: Final commit — nothing to commit**

If the manual smoke passed without adjustments, there's nothing to commit here. This task exists as a checkpoint.

---

## Spec Coverage Audit

| Spec requirement | Task |
|---|---|
| `activities.min_participants` column + constraint | Task 1 |
| `activity_sessions.quorum_state` + timestamps | Task 1 |
| New notification_type values | Task 1 |
| `cancel_session_with_refunds` RPC | Task 2 |
| `confirm_session_quorum` RPC | Task 3 |
| `evaluate_session_quorum` cron function | Task 3 |
| `expire_at_risk_sessions` cron function | Task 3 |
| `book_session` auto-confirm amendment | Task 3 |
| `book_session_from_webhook` auto-confirm amendment | Task 3 |
| `getQuorumStatus` helper | Task 4 |
| `min_participants` in DB types | Task 4 |
| Instructor form field | Task 5 |
| Validation (0 ≤ min ≤ max_seats) | Task 5 |
| `min_participants` in queries | Task 6 |
| Quorum fields in session embeds | Task 6 |
| Quorum promise line in booking sidebar | Task 7 |
| Quorum badges on time-slot cards | Task 8 |
| Post-booking confirmation notice | Task 9 |
| Confirm server action | Task 10 |
| Cancel server action | Task 10 |
| "Precisa de atenção" dashboard card | Task 11 |
| Email templates (at_risk + confirmed) | Task 12 |
| Email dispatcher registration | Task 12 |
| Hourly cron endpoint | Task 13 |
| `vercel.json` cron registration | Task 13 |
| Translation keys (pt/en/es) | Task 14 |
| Full regression test | Task 15 |
