/**
 * Shared helpers for integration tests that hit the local Supabase
 * instance. Load env, create clients, seed/teardown fixtures.
 */
import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Load .env.local manually — @next/env skips it when NODE_ENV=test.
 * Call once at the top of each integration test file.
 */
export function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/** Service-role client — bypasses RLS for seeding and teardown. */
export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Create a Supabase client authenticated as a seed user.
 * Uses signInWithPassword against the local auth server — all seed
 * accounts have password 'password123'.
 */
export async function authenticatedClient(
  email: string
): Promise<SupabaseClient> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (error) throw new Error(`Auth failed for ${email}: ${error.message}`);
  return client;
}

// ── Seed helpers ──────────────────────────────────────────────

const CATEGORY_ID = "cccccccc-0000-0000-0000-000000000001";

/** Ensure the test category exists (idempotent). */
export async function ensureTestCategory(client: SupabaseClient) {
  await client.from("categories").upsert({
    id: CATEGORY_ID,
    name: { pt: "Teste", en: "Test", es: "Prueba" },
    slug: "_test_",
    icon: "🧪",
  });
  return CATEGORY_ID;
}

/** Create or update a public.users row. */
export async function seedUser(
  client: SupabaseClient,
  id: string,
  overrides: Record<string, unknown> = {}
) {
  await client.from("users").upsert({
    id,
    name: `Test User ${id.slice(0, 8)}`,
    email: `test-${id.slice(0, 8)}@example.com`,
    role: "user",
    preferred_language: "pt",
    ...overrides,
  });
}

/** Create or update an instructor_profiles row. */
export async function seedInstructor(
  client: SupabaseClient,
  profileId: string,
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  await seedUser(client, userId, { role: "instructor" });
  await client.from("instructor_profiles").upsert({
    id: profileId,
    user_id: userId,
    bio: "Integration test instructor",
    specialties: ["testing"],
    approval_status: "approved",
    commission_rate: 0.15,
    ...overrides,
  });
}

/** Create or update a published activity. */
export async function seedActivity(
  client: SupabaseClient,
  id: string,
  instructorProfileId: string,
  overrides: Record<string, unknown> = {}
) {
  const catId = await ensureTestCategory(client);
  await client.from("activities").upsert({
    id,
    instructor_id: instructorProfileId,
    title: { pt: "Atividade teste", en: "Test activity" },
    description: { pt: "Descrição", en: "Description" },
    category_id: catId,
    price_cents: 10000,
    date: "2026-12-31",
    time: "10:00",
    duration_minutes: 60,
    address: "Rua Teste, 1",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    latitude: -23.55,
    longitude: -46.63,
    max_seats: 10,
    seats_remaining: 10,
    cover_image_url: "https://example.com/test.jpg",
    status: "published",
    ...overrides,
  });
}

/** Delete rows by id from a table. Ignores missing rows. */
export async function cleanup(
  client: SupabaseClient,
  table: string,
  ids: string[]
) {
  if (ids.length === 0) return;
  await client.from(table).delete().in("id", ids);
}
