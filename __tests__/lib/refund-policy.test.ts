import { computeRefundCents } from "@/lib/refund-policy";

describe("computeRefundCents - flexible", () => {
  const total = 10000; // R$ 100
  const policy = "flexible" as const;

  it("refunds 100% when ≥ 24h before start", () => {
    expect(computeRefundCents({ policy, hoursUntilStart: 24, totalPriceCents: total })).toBe(10000);
    expect(computeRefundCents({ policy, hoursUntilStart: 72, totalPriceCents: total })).toBe(10000);
  });

  it("refunds 0% when < 24h before start", () => {
    expect(computeRefundCents({ policy, hoursUntilStart: 23.9, totalPriceCents: total })).toBe(0);
    expect(computeRefundCents({ policy, hoursUntilStart: 0, totalPriceCents: total })).toBe(0);
  });

  it("refunds 0% for past activities", () => {
    expect(computeRefundCents({ policy, hoursUntilStart: -1, totalPriceCents: total })).toBe(0);
  });
});

describe("computeRefundCents - moderate", () => {
  const total = 10000;
  const policy = "moderate" as const;

  it("refunds 100% at ≥ 48h", () => {
    expect(computeRefundCents({ policy, hoursUntilStart: 48, totalPriceCents: total })).toBe(10000);
    expect(computeRefundCents({ policy, hoursUntilStart: 100, totalPriceCents: total })).toBe(10000);
  });

  it("refunds 50% between 24h and 48h", () => {
    expect(computeRefundCents({ policy, hoursUntilStart: 24, totalPriceCents: total })).toBe(5000);
    expect(computeRefundCents({ policy, hoursUntilStart: 47.9, totalPriceCents: total })).toBe(5000);
  });

  it("refunds 0% under 24h", () => {
    expect(computeRefundCents({ policy, hoursUntilStart: 23, totalPriceCents: total })).toBe(0);
  });
});

describe("computeRefundCents - strict", () => {
  const total = 10000;
  const policy = "strict" as const;

  it("refunds 100% at ≥ 168h (7 days)", () => {
    expect(computeRefundCents({ policy, hoursUntilStart: 168, totalPriceCents: total })).toBe(10000);
  });

  it("refunds 50% between 48h and 168h", () => {
    expect(computeRefundCents({ policy, hoursUntilStart: 48, totalPriceCents: total })).toBe(5000);
    expect(computeRefundCents({ policy, hoursUntilStart: 167, totalPriceCents: total })).toBe(5000);
  });

  it("refunds 0% under 48h", () => {
    expect(computeRefundCents({ policy, hoursUntilStart: 47, totalPriceCents: total })).toBe(0);
  });
});

describe("computeRefundCents - rounding", () => {
  it("rounds to nearest cent for odd totals at 50%", () => {
    // 9999 / 2 = 4999.5 → 5000 (round half to even or half up, doesn't matter as long as consistent)
    expect(
      computeRefundCents({
        policy: "moderate",
        hoursUntilStart: 30,
        totalPriceCents: 9999,
      })
    ).toBe(5000);
  });
});
