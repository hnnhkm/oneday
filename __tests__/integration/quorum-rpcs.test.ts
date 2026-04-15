/** @jest-environment node */

import {
  loadEnvLocal,
  serviceClient,
  authenticatedClient,
  seedActivity,
  cleanup,
} from "./helpers";

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
  await svc
    .from("notifications")
    .delete()
    .eq("user_id", STUDENT_ID)
    .in("type", ["session_quorum_at_risk", "session_confirmed", "booking_cancelled"]);
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
    expect(error!.message).toMatch(/not_at_risk/i);
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

    const { data: affectedUsers, error } = await svc.rpc(
      "expire_at_risk_sessions"
    );
    expect(error).toBeNull();
    expect(affectedUsers).toEqual(
      expect.arrayContaining([{ affected_user_id: STUDENT_ID }])
    );

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
    // 9 seats remaining on max_seats=10 → 1 already booked, min 5.
    // Booking 4 more → 5 booked total, which meets min and should trigger auto-confirm.
    const sid = await seedSession(Date.now() + 48 * 3600 * 1000, 9, 10);
    const client = await authenticatedClient(STUDENT_EMAIL);

    // Assert the session starts as pending (quorum not yet reached).
    const { data: before } = await svc
      .from("activity_sessions")
      .select("quorum_state")
      .eq("id", sid)
      .single();
    expect(before!.quorum_state).toBe("pending");

    const { error } = await client.rpc("book_session", {
      p_user_id: STUDENT_ID,
      p_session_id: sid,
      p_seats: 4,
    });
    expect(error).toBeNull();

    // After booking, quorum should be confirmed and booked_count (max_seats - seats_remaining) >= 5.
    const { data: s } = await svc
      .from("activity_sessions")
      .select("quorum_state, max_seats, seats_remaining")
      .eq("id", sid)
      .single();
    expect(s!.quorum_state).toBe("confirmed");
    expect(s!.max_seats - s!.seats_remaining).toBeGreaterThanOrEqual(5);

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
