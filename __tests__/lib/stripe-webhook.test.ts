import { parseCheckoutSessionCompleted } from "@/lib/stripe-webhook";

describe("parseCheckoutSessionCompleted", () => {
  const base = {
    id: "cs_test_123",
    object: "checkout.session" as const,
    payment_status: "paid" as const,
    metadata: {
      activity_id: "11111111-1111-1111-1111-111111111111",
      activity_session_id: "33333333-3333-3333-3333-333333333333",
      user_id: "22222222-2222-2222-2222-222222222222",
      seats: "2",
      locale: "pt",
    },
  };

  it("returns a create action for a paid session with valid metadata", () => {
    const result = parseCheckoutSessionCompleted(base);
    expect(result).toEqual({
      action: "create_booking",
      sessionId: "cs_test_123",
      activitySessionId: "33333333-3333-3333-3333-333333333333",
      activityId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      seats: 2,
    });
  });

  it("ignores legacy in-flight checkouts that lack activity_session_id", () => {
    // Stripe Checkout metadata is immutable once the session is
    // created, so a release that lands while a user has a cart
    // already open will hit this branch. We 200 the webhook and let
    // the refund path kick in.
    const { activity_session_id: _omit, ...legacyMeta } = base.metadata;
    void _omit;
    const result = parseCheckoutSessionCompleted({
      ...base,
      metadata: legacyMeta,
    });
    expect(result).toEqual({
      action: "ignore",
      reason: "legacy_missing_session",
    });
  });

  it("ignores sessions whose payment has not cleared", () => {
    const result = parseCheckoutSessionCompleted({
      ...base,
      payment_status: "unpaid",
    });
    expect(result).toEqual({
      action: "ignore",
      reason: "payment_not_paid",
    });
  });

  it("rejects sessions missing required metadata", () => {
    const result = parseCheckoutSessionCompleted({
      ...base,
      metadata: { activity_id: "a", user_id: "b" }, // no seats
    });
    expect(result).toEqual({
      action: "ignore",
      reason: "missing_metadata",
    });
  });

  it("rejects sessions with a non-numeric seats value", () => {
    const result = parseCheckoutSessionCompleted({
      ...base,
      metadata: { ...base.metadata, seats: "abc" },
    });
    expect(result).toEqual({
      action: "ignore",
      reason: "invalid_seats",
    });
  });

  it("rejects sessions with zero or negative seats", () => {
    const result = parseCheckoutSessionCompleted({
      ...base,
      metadata: { ...base.metadata, seats: "0" },
    });
    expect(result).toEqual({
      action: "ignore",
      reason: "invalid_seats",
    });
  });

  it("rejects sessions missing metadata entirely", () => {
    const result = parseCheckoutSessionCompleted({
      ...base,
      metadata: null,
    });
    expect(result).toEqual({
      action: "ignore",
      reason: "missing_metadata",
    });
  });

  it("strips leading/trailing whitespace around seat counts", () => {
    const result = parseCheckoutSessionCompleted({
      ...base,
      metadata: { ...base.metadata, seats: "  3  " },
    });
    expect(result).toMatchObject({ action: "create_booking", seats: 3 });
  });
});
