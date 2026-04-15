import {
  canPublishActivity,
  canDeleteActivity,
  canCancelActivity,
  type ActivityInput,
} from "@/lib/queries/activities";

function validInput(): ActivityInput {
  return {
    title: { pt: "x", en: "", es: "" },
    description: { pt: "x", en: "", es: "" },
    category_id: "10000000-0000-0000-0000-000000000001",
    tags: [],
    price_cents: 5000,
    date: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
    time: "10:00",
    duration_minutes: 60,
    address: "Rua X",
    neighborhood: "Y",
    city: "São Paulo",
    state: "SP",
    max_seats: 5,
    min_participants: 0,
    cover_image_url: "https://cdn/cover.jpg",
    gallery_image_urls: [],
    cancellation_policy: "flexible",
    cancellation_policy_text: null,
    no_show_fee_cents: null,
  };
}

describe("canPublishActivity", () => {
  it("returns true when input is valid AND geocoded AND cover present", () => {
    expect(canPublishActivity(validInput(), { lat: -23.5, lng: -46.6 })).toBe(
      true
    );
  });

  it("returns false when geocoded is null", () => {
    expect(canPublishActivity(validInput(), null)).toBe(false);
  });

  it("returns false when cover image missing", () => {
    const input = validInput();
    input.cover_image_url = "";
    expect(canPublishActivity(input, { lat: -23.5, lng: -46.6 })).toBe(false);
  });

  it("returns false when any validation fails", () => {
    const input = validInput();
    input.price_cents = 100;
    expect(canPublishActivity(input, { lat: -23.5, lng: -46.6 })).toBe(false);
  });
});

describe("canDeleteActivity", () => {
  it("allows deletion when bookingCount is 0", () => {
    expect(canDeleteActivity({ bookingCount: 0 })).toBe(true);
  });

  it("blocks deletion when bookingCount > 0", () => {
    expect(canDeleteActivity({ bookingCount: 1 })).toBe(false);
    expect(canDeleteActivity({ bookingCount: 42 })).toBe(false);
  });
});

describe("canCancelActivity", () => {
  const today = "2026-04-11";

  it("allows cancelling a future published activity", () => {
    expect(
      canCancelActivity({
        status: "published",
        date: "2026-04-20",
        today,
      })
    ).toBe(true);
  });

  it("allows cancelling a published activity happening today", () => {
    expect(
      canCancelActivity({ status: "published", date: today, today })
    ).toBe(true);
  });

  it("blocks cancelling a published activity that already happened", () => {
    expect(
      canCancelActivity({
        status: "published",
        date: "2026-04-01",
        today,
      })
    ).toBe(false);
  });

  it("blocks cancelling a draft (no bookings to cancel)", () => {
    expect(
      canCancelActivity({
        status: "draft",
        date: "2026-04-20",
        today,
      })
    ).toBe(false);
  });

  it("blocks cancelling an already cancelled activity", () => {
    expect(
      canCancelActivity({
        status: "cancelled",
        date: "2026-04-20",
        today,
      })
    ).toBe(false);
  });

  it("blocks cancelling a completed activity", () => {
    expect(
      canCancelActivity({
        status: "completed",
        date: "2026-04-01",
        today,
      })
    ).toBe(false);
  });
});
