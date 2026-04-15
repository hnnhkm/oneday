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

// Seed accounts.
const STUDENT_ID = "30000000-0000-0000-0000-000000000001"; // ana
const INSTRUCTOR_USER_ID = "20000000-0000-0000-0000-000000000001"; // mariana
const INSTRUCTOR_PROFILE_ID = "40000000-0000-0000-0000-000000000001";
const ADMIN_USER_ID = "10000000-aaaa-0000-0000-000000000001"; // admin

// Test-specific IDs.
const ACTIVITY_CANCEL = "bbbbbb02-0000-0000-0000-000000000001";
const ACTIVITY_ADMIN_CANCEL = "bbbbbb02-0000-0000-0000-000000000002";

let instructorClient: SupabaseClient;
let adminClient: SupabaseClient;
let createdBookingIds: string[] = [];

beforeAll(async () => {
  instructorClient = await authenticatedClient("mariana@example.com");
  adminClient = await authenticatedClient("admin@example.com");

  // Activity for instructor-cancel test.
  await seedActivity(svc, ACTIVITY_CANCEL, INSTRUCTOR_PROFILE_ID, {
    max_seats: 10,
    seats_remaining: 10,
  });
  // Activity for admin-cancel test.
  await seedActivity(svc, ACTIVITY_ADMIN_CANCEL, INSTRUCTOR_PROFILE_ID, {
    max_seats: 10,
    seats_remaining: 10,
  });

  // Create bookings on both activities via the webhook RPC.
  for (const [actId, prefix] of [
    [ACTIVITY_CANCEL, "cancel"],
    [ACTIVITY_ADMIN_CANCEL, "admin_cancel"],
  ] as const) {
    const { data: bid } = await svc.rpc("book_activity_from_webhook", {
      p_user_id: STUDENT_ID,
      p_activity_id: actId,
      p_seats: 2,
      p_session_id: `cs_test_${prefix}_${Date.now()}`,
    });
    if (bid) createdBookingIds.push(bid as string);
  }
});

afterAll(async () => {
  // Clean notifications created by cancel RPCs.
  await svc
    .from("notifications")
    .delete()
    .eq("user_id", STUDENT_ID)
    .eq("type", "booking_cancelled");

  if (createdBookingIds.length > 0) {
    await cleanup(svc, "bookings", createdBookingIds);
  }
  await cleanup(svc, "activities", [ACTIVITY_CANCEL, ACTIVITY_ADMIN_CANCEL]);
});

describe("cancel_activity_with_refunds RPC (instructor-initiated)", () => {
  it("cancels the activity, refunds bookings, and creates notifications", async () => {
    const { data: affected, error } = await instructorClient.rpc(
      "cancel_activity_with_refunds",
      {
        p_activity_id: ACTIVITY_CANCEL,
        p_reason: "Integration test cancel",
      }
    );

    expect(error).toBeNull();
    expect(affected).toBe(1); // 1 booking

    // Verify activity status.
    const { data: activity } = await svc
      .from("activities")
      .select("status")
      .eq("id", ACTIVITY_CANCEL)
      .single();
    expect(activity?.status).toBe("cancelled");

    // Verify booking status.
    const { data: bookings } = await svc
      .from("bookings")
      .select("status, payment_status, cancelled_at")
      .eq("activity_id", ACTIVITY_CANCEL);
    expect(bookings).toHaveLength(1);
    expect(bookings![0].status).toBe("cancelled");
    expect(bookings![0].payment_status).toBe("refunded");
    expect(bookings![0].cancelled_at).not.toBeNull();

    // Verify notification was created for the student.
    const { data: notifs } = await svc
      .from("notifications")
      .select("type, body")
      .eq("user_id", STUDENT_ID)
      .eq("type", "booking_cancelled")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(notifs).toHaveLength(1);
    expect(notifs![0].body).toContain("Integration test cancel");
  });

  it("rejects cancellation of an already-cancelled activity", async () => {
    const { error } = await instructorClient.rpc(
      "cancel_activity_with_refunds",
      {
        p_activity_id: ACTIVITY_CANCEL,
        p_reason: "Try again",
      }
    );

    expect(error).not.toBeNull();
    expect(error!.message).toContain("activity_not_cancellable");
  });
});

describe("admin_cancel_activity_with_refunds RPC", () => {
  it("cancels with admin auth and notifies bookers", async () => {
    const { data: affected, error } = await adminClient.rpc(
      "admin_cancel_activity_with_refunds",
      {
        p_activity_id: ACTIVITY_ADMIN_CANCEL,
        p_reason: "Admin test cancel",
      }
    );

    expect(error).toBeNull();
    expect(affected).toBe(1);

    // Verify activity cancelled.
    const { data: activity } = await svc
      .from("activities")
      .select("status")
      .eq("id", ACTIVITY_ADMIN_CANCEL)
      .single();
    expect(activity?.status).toBe("cancelled");

    // Verify booking flipped.
    const { data: bookings } = await svc
      .from("bookings")
      .select("status, payment_status")
      .eq("activity_id", ACTIVITY_ADMIN_CANCEL);
    expect(bookings).toHaveLength(1);
    expect(bookings![0].status).toBe("cancelled");
    expect(bookings![0].payment_status).toBe("refunded");
  });

  it("rejects when called by a non-admin", async () => {
    // Instructor trying to use the admin RPC.
    const { error } = await instructorClient.rpc(
      "admin_cancel_activity_with_refunds",
      {
        p_activity_id: ACTIVITY_ADMIN_CANCEL,
        p_reason: "Unauthorized",
      }
    );

    expect(error).not.toBeNull();
    expect(error!.message).toContain("not_authorized");
  });
});
