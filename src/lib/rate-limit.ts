/**
 * Tiny in-memory fixed-window rate limiter, scoped to this Node
 * process. Resets on restart. Intended to stop accidental
 * hammering of Nominatim + review photo uploads by a single
 * authenticated user, not as a hard quota across a distributed
 * deployment — upgrade to Redis when you need that.
 *
 * Fixed-window (not sliding) because it's one if-branch, no
 * allocations in the hot path, and "almost 2x the limit right at
 * the window boundary" is an acceptable trade-off for the low
 * burst sizes this is guarding.
 */

interface WindowState {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, WindowState>();

export interface RateLimitOptions {
  /** Max calls per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now()
): RateLimitResult {
  const { limit, windowMs } = options;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { ok: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    const retryAfterMs = windowMs - (now - existing.windowStart);
    return { ok: false, retryAfterMs };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}

/** Jest-only hook so tests don't bleed state across cases. */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}
