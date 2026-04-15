import { computeApplicationFeeCents } from "@/lib/commission";

describe("computeApplicationFeeCents", () => {
  it("takes a straight 15% of a round total", () => {
    expect(computeApplicationFeeCents(10000, 0.15)).toBe(1500);
  });

  it("rounds half-to-even on fractional cents", () => {
    // 9999 * 0.15 = 1499.85 → round half up = 1500
    expect(computeApplicationFeeCents(9999, 0.15)).toBe(1500);
    // 12345 * 0.1 = 1234.5 → round half up = 1235
    expect(computeApplicationFeeCents(12345, 0.1)).toBe(1235);
  });

  it("returns 0 when the commission rate is 0", () => {
    expect(computeApplicationFeeCents(10000, 0)).toBe(0);
  });

  it("caps at the total when the rate is >= 1", () => {
    // Shouldn't happen, but we don't want to over-bill.
    expect(computeApplicationFeeCents(10000, 1)).toBe(10000);
    expect(computeApplicationFeeCents(10000, 1.5)).toBe(10000);
  });

  it("returns 0 for a zero total", () => {
    expect(computeApplicationFeeCents(0, 0.15)).toBe(0);
  });

  it("treats negative totals as 0", () => {
    expect(computeApplicationFeeCents(-500, 0.15)).toBe(0);
  });
});
