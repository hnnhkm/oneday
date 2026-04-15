"use server";

import {
  geocodeAddress,
  reverseGeocode,
  type ReverseGeocodeResult,
} from "@/lib/geocoding";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Thin server-action wrappers around the Nominatim helpers so
 * client components can call them without pulling in the
 * `next: { revalidate }` fetch option (which is server-only).
 *
 * Rate-limited to 10 calls per minute per authenticated user.
 * Nominatim's public instance has a 1 req/sec policy; this cap
 * stops any single user from burning that budget on behalf of
 * the whole app. Unauthenticated requests are rejected outright.
 */

const GEOCODE_LIMIT = { limit: 10, windowMs: 60_000 };

async function rateLimitKey(prefix: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? `${prefix}:${user.id}` : null;
}

export async function forwardGeocodeAction(
  address: string,
  city: string,
  state: string
): Promise<{ lat: number; lng: number } | null> {
  const key = await rateLimitKey("geocode");
  if (!key) return null;
  if (!checkRateLimit(key, GEOCODE_LIMIT).ok) return null;
  return geocodeAddress(address, city, state);
}

export async function reverseGeocodeAction(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const key = await rateLimitKey("reverse-geocode");
  if (!key) return null;
  if (!checkRateLimit(key, GEOCODE_LIMIT).ok) return null;
  return reverseGeocode(lat, lng);
}
