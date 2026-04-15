import {
  categorizeBooking,
  canCancelBooking,
  canReviewBooking,
  canMarkNoShow,
} from "@/lib/queries/bookings";

describe("categorizeBooking", () => {
  const today = "2026-04-10";

  it("returns 'cancelled' for any cancelled booking regardless of date", () => {
    expect(
      categorizeBooking({ status: "cancelled" }, "2026-05-01", today)
    ).toBe("cancelled");
    expect(
      categorizeBooking({ status: "cancelled" }, "2026-01-01", today)
    ).toBe("cancelled");
  });

  it("returns 'past' for confirmed bookings with past activity dates", () => {
    expect(
      categorizeBooking({ status: "confirmed" }, "2026-04-09", today)
    ).toBe("past");
  });

  it("returns 'past' for completed bookings with past activity dates", () => {
    expect(
      categorizeBooking({ status: "completed" }, "2026-04-01", today)
    ).toBe("past");
  });

  it("returns 'upcoming' for confirmed bookings on today or later", () => {
    expect(
      categorizeBooking({ status: "confirmed" }, "2026-04-10", today)
    ).toBe("upcoming");
    expect(
      categorizeBooking({ status: "confirmed" }, "2026-05-01", today)
    ).toBe("upcoming");
  });
});

describe("canCancelBooking", () => {
  const today = "2026-04-10";

  it("allows cancelling confirmed bookings with future activity dates", () => {
    expect(
      canCancelBooking({ status: "confirmed" }, "2026-05-01", today)
    ).toBe(true);
  });

  it("allows cancelling confirmed bookings on the activity date itself", () => {
    expect(
      canCancelBooking({ status: "confirmed" }, "2026-04-10", today)
    ).toBe(true);
  });

  it("blocks cancelling past activities", () => {
    expect(
      canCancelBooking({ status: "confirmed" }, "2026-04-09", today)
    ).toBe(false);
  });

  it("blocks cancelling already-cancelled bookings", () => {
    expect(
      canCancelBooking({ status: "cancelled" }, "2026-05-01", today)
    ).toBe(false);
  });

  it("blocks cancelling completed bookings", () => {
    expect(
      canCancelBooking({ status: "completed" }, "2026-05-01", today)
    ).toBe(false);
  });
});

describe("canReviewBooking", () => {
  const today = "2026-04-10";

  it("allows reviewing past confirmed bookings", () => {
    expect(
      canReviewBooking({ status: "confirmed" }, "2026-04-09", today)
    ).toBe(true);
  });

  it("allows reviewing past completed bookings", () => {
    expect(
      canReviewBooking({ status: "completed" }, "2026-04-01", today)
    ).toBe(true);
  });

  it("blocks reviewing future bookings", () => {
    expect(
      canReviewBooking({ status: "confirmed" }, "2026-05-01", today)
    ).toBe(false);
  });

  it("blocks reviewing today's bookings", () => {
    expect(
      canReviewBooking({ status: "confirmed" }, "2026-04-10", today)
    ).toBe(false);
  });

  it("blocks reviewing cancelled bookings even if past", () => {
    expect(
      canReviewBooking({ status: "cancelled" }, "2026-04-01", today)
    ).toBe(false);
  });
});

describe("canMarkNoShow", () => {
  const today = "2026-04-11";

  it("allows marking a confirmed booking on a past activity", () => {
    expect(
      canMarkNoShow({
        status: "confirmed",
        noShow: false,
        activityDate: "2026-04-01",
        today,
      })
    ).toBe(true);
  });

  it("allows marking a completed booking on a past activity", () => {
    expect(
      canMarkNoShow({
        status: "completed",
        noShow: false,
        activityDate: "2026-04-01",
        today,
      })
    ).toBe(true);
  });

  it("blocks marking a future activity", () => {
    expect(
      canMarkNoShow({
        status: "confirmed",
        noShow: false,
        activityDate: "2026-04-20",
        today,
      })
    ).toBe(false);
  });

  it("blocks marking today's activity", () => {
    expect(
      canMarkNoShow({
        status: "confirmed",
        noShow: false,
        activityDate: today,
        today,
      })
    ).toBe(false);
  });

  it("blocks marking a cancelled booking", () => {
    expect(
      canMarkNoShow({
        status: "cancelled",
        noShow: false,
        activityDate: "2026-04-01",
        today,
      })
    ).toBe(false);
  });

  it("blocks marking a booking already flagged as no-show", () => {
    expect(
      canMarkNoShow({
        status: "completed",
        noShow: true,
        activityDate: "2026-04-01",
        today,
      })
    ).toBe(false);
  });
});
