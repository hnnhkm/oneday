/** @jest-environment node */

import {
  loadEnvLocal,
  serviceClient,
  seedActivity,
  cleanup,
} from "./helpers";

loadEnvLocal();

const svc = serviceClient();

// Use existing seed accounts (FK to auth.users prevents creating new ones).
// ana@example.com = student
const STUDENT_ID = "30000000-0000-0000-0000-000000000001";
// mariana@example.com = approved instructor
const INSTRUCTOR_USER_ID = "20000000-0000-0000-0000-000000000001";
const INSTRUCTOR_PROFILE_ID = "40000000-0000-0000-0000-000000000001";

// Test activity — created by our seed helper, cleaned up after.
const TEST_ACTIVITY_ID = "bbbbbb01-0000-0000-0000-000000000099";

let createdBookingIds: string[] = [];

beforeAll(async () => {
  await seedActivity(svc, TEST_ACTIVITY_ID, INSTRUCTOR_PROFILE_ID, {
    max_seats: 5,
    seats_remaining: 5,
    price_cents: 10000,
  });
});

afterAll(async () => {
  if (createdBookingIds.length > 0) {
    await cleanup(svc, "bookings", createdBookingIds);
  }
  await cleanup(svc, "activities", [TEST_ACTIVITY_ID]);
});

describe("book_activity_from_webhook RPC", () => {
  it("creates a booking and decrements seats", async () => {
    const sessionId = "cs_test_integration_" + Date.now();
    const { data: bookingId, error } = await svc.rpc(
      "book_activity_from_webhook",
      {
        p_user_id: STUDENT_ID,
        p_activity_id: TEST_ACTIVITY_ID,
        p_seats: 2,
        p_session_id: sessionId,
      }
    );

    expect(error).toBeNull();
    expect(typeof bookingId).toBe("string");
    createdBookingIds.push(bookingId as string);

    // Verify the booking row.
    const { data: booking } = await svc
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();
    expect(booking).toMatchObject({
      user_id: STUDENT_ID,
      activity_id: TEST_ACTIVITY_ID,
      seats_booked: 2,
      total_price_cents: 20000,
      status: "confirmed",
      payment_status: "paid",
      stripe_session_id: sessionId,
    });

    // Verify seats decremented.
    const { data: activity } = await svc
      .from("activities")
      .select("seats_remaining")
      .eq("id", TEST_ACTIVITY_ID)
      .single();
    expect(activity?.seats_remaining).toBe(3);
  });

  it("is idempotent — returns existing booking on retry", async () => {
    const sessionId = "cs_test_idempotent_" + Date.now();

    const { data: first } = await svc.rpc("book_activity_from_webhook", {
      p_user_id: STUDENT_ID,
      p_activity_id: TEST_ACTIVITY_ID,
      p_seats: 1,
      p_session_id: sessionId,
    });
    createdBookingIds.push(first as string);

    // Same session id — should return same booking without consuming more seats.
    const seatsBefore = await svc
      .from("activities")
      .select("seats_remaining")
      .eq("id", TEST_ACTIVITY_ID)
      .single();

    const { data: second, error } = await svc.rpc(
      "book_activity_from_webhook",
      {
        p_user_id: STUDENT_ID,
        p_activity_id: TEST_ACTIVITY_ID,
        p_seats: 1,
        p_session_id: sessionId,
      }
    );

    expect(error).toBeNull();
    expect(second).toBe(first);

    // Seats unchanged by the retry.
    const seatsAfter = await svc
      .from("activities")
      .select("seats_remaining")
      .eq("id", TEST_ACTIVITY_ID)
      .single();
    expect(seatsAfter.data?.seats_remaining).toBe(
      seatsBefore.data?.seats_remaining
    );
  });

  it("rejects self-booking (instructor booking their own activity)", async () => {
    const sessionId = "cs_test_selfbook_" + Date.now();

    const { error } = await svc.rpc("book_activity_from_webhook", {
      p_user_id: INSTRUCTOR_USER_ID,
      p_activity_id: TEST_ACTIVITY_ID,
      p_seats: 1,
      p_session_id: sessionId,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("cannot book your own activity");
  });

  it("rejects when not enough seats remaining", async () => {
    const sessionId = "cs_test_noseats_" + Date.now();

    const { error } = await svc.rpc("book_activity_from_webhook", {
      p_user_id: STUDENT_ID,
      p_activity_id: TEST_ACTIVITY_ID,
      p_seats: 999,
      p_session_id: sessionId,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("not enough seats");
  });
});
