/**
 * Nominatim (OpenStreetMap) geocoder. Server-side only — we set a
 * User-Agent per Nominatim's usage policy and never call this from the
 * browser.
 *
 * Trade-offs captured in the spec:
 *  - No API key, no billing, free for personal-scale use.
 *  - 1 req/sec rate limit is trivially satisfied because we only geocode
 *    on form submit, not keystroke.
 *  - Brazil-only scope (countrycodes=br) keeps false positives low.
 *  - On timeout or empty result we return null and surface a friendly
 *    error upstream so the user can retry or save as draft.
 */
export interface GeocodeResult {
  lat: number;
  lng: number;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

export async function geocodeAddress(
  address: string,
  city: string,
  state: string
): Promise<GeocodeResult | null> {
  const parts = [address, city, state, "Brasil"]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
  if (!parts) return null;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("q", parts);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "oneday/dev (+https://example.com)",
        Accept: "application/json",
      },
      // Nominatim results are cachable; let Next tag this so we can
      // avoid hammering if the same address is geocoded twice.
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(json) || json.length === 0) return null;
    const first = json[0];
    const lat = Number.parseFloat(first.lat);
    const lng = Number.parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reverse geocode a lat/lng back into address parts. Powers the
 * map-picker drag-to-fill flow. Returns the best-guess address
 * components we care about; caller only applies fields that came
 * back non-empty so the user's manual edits aren't clobbered.
 */
export interface ReverseGeocodeResult {
  address: string;
  neighborhood: string;
  city: string;
  state: string;
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lon", lng.toString());
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "oneday/dev (+https://example.com)",
        Accept: "application/json",
      },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      address?: {
        road?: string;
        house_number?: string;
        suburb?: string;
        neighbourhood?: string;
        city_district?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        state_code?: string;
      };
    };
    const a = json.address || {};

    const streetParts = [a.road, a.house_number].filter(Boolean).join(", ");
    const neighborhood = a.suburb || a.neighbourhood || a.city_district || "";
    const city = a.city || a.town || a.village || "";
    // Prefer 2-letter state codes (SP, RJ...) for BR; fall back to name.
    const state = a.state_code
      ? a.state_code.toUpperCase().replace(/^BR-/, "")
      : a.state || "";

    return {
      address: streetParts,
      neighborhood,
      city,
      state,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
