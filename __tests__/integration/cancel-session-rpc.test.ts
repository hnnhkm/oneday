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
  if (sessionId) await svc.from("activity_sessions").delete().eq("id", sessionId);
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
    expect(error!.message).toMatch(/session_already_cancelled/i);
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
