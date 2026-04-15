/** @jest-environment node */

// @next/env intentionally skips .env.local when NODE_ENV=test.
// Load it manually before creating any Supabase clients.
import fs from "fs";
import path from "path";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service-role client bypasses RLS for seeding/teardown.
const service = createClient(SUPABASE_URL, SERVICE_KEY);
// Anon client simulates a real browser request.
const anon = createClient(SUPABASE_URL, ANON_KEY);

// Fixed test IDs so seed + teardown are idempotent.
const A_CERAMICA_INIT = "aaaaaaa1-0000-0000-0000-000000000001";
const A_CERAMICA_ADV = "aaaaaaa1-0000-0000-0000-000000000002";
const A_SUSHI_TITLE = "aaaaaaa1-0000-0000-0000-000000000003";
const A_SUSHI_DESC = "aaaaaaa1-0000-0000-0000-000000000004";
const A_CERAMICA_DRAFT = "aaaaaaa1-0000-0000-0000-000000000005";

const ALL_TEST_IDS = [
  A_CERAMICA_INIT,
  A_CERAMICA_ADV,
  A_SUSHI_TITLE,
  A_SUSHI_DESC,
  A_CERAMICA_DRAFT,
];

async function getSeedFixtureIds() {
  const { data: instructor } = await service
    .from("instructor_profiles")
    .select("id")
    .eq("approval_status", "approved")
    .limit(1)
    .single();
  const { data: category } = await service
    .from("categories")
    .select("id")
    .limit(1)
    .single();
  if (!instructor || !category) {
    throw new Error("Missing seed instructor/category — run supabase db reset first");
  }
  return { instructorId: (instructor as { id: string }).id, categoryId: (category as { id: string }).id };
}

describe("search_activities_rank RPC", () => {
  let instructorId: string;
  let categoryId: string;

  beforeAll(async () => {
    ({ instructorId, categoryId } = await getSeedFixtureIds());

    // Clean slate in case a prior failed run left rows behind.
    await service.from("activities").delete().in("id", ALL_TEST_IDS);

    const futureDate = new Date(Date.now() + 30 * 86400_000)
      .toISOString()
      .slice(0, 10);

    const baseRow = {
      instructor_id: instructorId,
      category_id: categoryId,
      price_cents: 10000,
      date: futureDate,
      time: "14:00",
      duration_minutes: 120,
      address: "Rua Harmonia, 350",
      neighborhood: "Vila Madalena",
      city: "São Paulo",
      state: "SP",
      latitude: -23.5505,
      longitude: -46.6333,
      max_seats: 10,
      seats_remaining: 10,
      cover_image_url: "https://example.com/cover.jpg",
      gallery_image_urls: [],
      cancellation_policy: "flexible",
      tags: [],
    };

    const { error } = await service.from("activities").insert([
      {
        ...baseRow,
        id: A_CERAMICA_INIT,
        title: { pt: "Cerâmica para iniciantes", en: "Pottery basics", es: "" },
        description: { pt: "Aula introdutória de cerâmica", en: "", es: "" },
        status: "published",
      },
      {
        ...baseRow,
        id: A_CERAMICA_ADV,
        title: { pt: "Cerâmica avançada", en: "Advanced pottery", es: "" },
        description: { pt: "Para alunos intermediários", en: "", es: "" },
        status: "published",
      },
      {
        ...baseRow,
        id: A_SUSHI_TITLE,
        title: { pt: "Sushi para iniciantes", en: "", es: "" },
        description: { pt: "Aprenda rolls clássicos", en: "", es: "" },
        status: "published",
      },
      {
        ...baseRow,
        id: A_SUSHI_DESC,
        title: { pt: "Culinária japonesa", en: "", es: "" },
        description: { pt: "Inclui uma introdução a sushi no final da aula", en: "", es: "" },
        status: "published",
      },
      {
        ...baseRow,
        id: A_CERAMICA_DRAFT,
        title: { pt: "Cerâmica secreta", en: "", es: "" },
        description: { pt: "Rascunho não publicado", en: "", es: "" },
        status: "draft",
      },
    ]);

    if (error) throw new Error(`Seed failed: ${error.message}`);
  }, 30_000);

  afterAll(async () => {
    await service.from("activities").delete().in("id", ALL_TEST_IDS);
  });

  it("folds accents (ceramica → cerâmica)", async () => {
    const { data, error } = await anon.rpc("search_activities_rank", {
      q: "ceramica",
    });
    expect(error).toBeNull();
    const ids = (data as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([A_CERAMICA_INIT, A_CERAMICA_ADV])
    );
  });

  it("stems plurals (ceramicas → cerâmica)", async () => {
    const { data } = await anon.rpc("search_activities_rank", {
      q: "ceramicas",
    });
    const ids = (data as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([A_CERAMICA_INIT, A_CERAMICA_ADV])
    );
  });

  it("matches cross-locale (pottery → pt title)", async () => {
    const { data } = await anon.rpc("search_activities_rank", {
      q: "pottery",
    });
    const ids = (data as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([A_CERAMICA_INIT, A_CERAMICA_ADV])
    );
  });

  it("weights title matches above description matches", async () => {
    const { data } = await anon.rpc("search_activities_rank", { q: "sushi" });
    const rows = data as { id: string; rank: number }[];
    const titleRow = rows.find((r) => r.id === A_SUSHI_TITLE)!;
    const descRow = rows.find((r) => r.id === A_SUSHI_DESC)!;
    expect(titleRow).toBeDefined();
    expect(descRow).toBeDefined();
    expect(titleRow.rank).toBeGreaterThan(descRow.rank);
  });

  it("honors websearch_to_tsquery exclusion (-)", async () => {
    const { data } = await anon.rpc("search_activities_rank", {
      q: "cerâmica -iniciante",
    });
    const ids = (data as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(A_CERAMICA_ADV);
    expect(ids).not.toContain(A_CERAMICA_INIT);
  });

  it("never returns draft activities", async () => {
    const { data } = await anon.rpc("search_activities_rank", {
      q: "cerâmica",
    });
    const ids = (data as { id: string }[]).map((r) => r.id);
    expect(ids).not.toContain(A_CERAMICA_DRAFT);
  });

  it("returns zero rows for a nonsense query", async () => {
    const { data } = await anon.rpc("search_activities_rank", {
      q: "xyzzyhasnomatches",
    });
    expect(data).toHaveLength(0);
  });
});
