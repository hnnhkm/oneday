import { checkRateLimit, __resetRateLimitForTests } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  it("allows the first N calls within the window", () => {
    for (let i = 0; i < 10; i++) {
      expect(
        checkRateLimit("user1", { limit: 10, windowMs: 60_000 })
      ).toEqual({ ok: true, remaining: 10 - i - 1 });
    }
  });

  it("blocks the 11th call in a 10-per-minute window", () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit("user1", { limit: 10, windowMs: 60_000 });
    }
    const r = checkRateLimit("user1", { limit: 10, windowMs: 60_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("isolates quotas per key", () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit("user1", { limit: 10, windowMs: 60_000 });
    }
    expect(
      checkRateLimit("user2", { limit: 10, windowMs: 60_000 }).ok
    ).toBe(true);
  });

  it("releases entries after the window expires", () => {
    const now = Date.now();
    const later = now + 61_000;
    for (let i = 0; i < 10; i++) {
      checkRateLimit("user1", { limit: 10, windowMs: 60_000 }, now);
    }
    expect(
      checkRateLimit("user1", { limit: 10, windowMs: 60_000 }, now).ok
    ).toBe(false);
    expect(
      checkRateLimit("user1", { limit: 10, windowMs: 60_000 }, later).ok
    ).toBe(true);
  });
});
