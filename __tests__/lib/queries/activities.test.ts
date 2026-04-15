import { buildActivityQuery } from "@/lib/queries/activities";

describe("buildActivityQuery", () => {
  it("returns base filters for no params", () => {
    const filters = buildActivityQuery({});
    expect(filters.status).toBe("published");
    expect(filters.categoryIds).toBeUndefined();
    expect(filters.neighborhoods).toBeUndefined();
    expect(filters.minPrice).toBeUndefined();
  });

  it("includes categoryIds when provided", () => {
    const filters = buildActivityQuery({
      categoryIds: ["abc-123", "def-456"],
    });
    expect(filters.categoryIds).toEqual(["abc-123", "def-456"]);
  });

  it("drops empty categoryIds array", () => {
    const filters = buildActivityQuery({ categoryIds: [] });
    expect(filters.categoryIds).toBeUndefined();
  });

  it("includes neighborhoods when provided", () => {
    const filters = buildActivityQuery({
      neighborhoods: ["Vila Madalena", "Pinheiros"],
    });
    expect(filters.neighborhoods).toEqual(["Vila Madalena", "Pinheiros"]);
  });

  it("drops empty neighborhoods array", () => {
    const filters = buildActivityQuery({ neighborhoods: [] });
    expect(filters.neighborhoods).toBeUndefined();
  });

  it("includes price range when provided", () => {
    const filters = buildActivityQuery({ minPrice: 5000, maxPrice: 20000 });
    expect(filters.minPrice).toBe(5000);
    expect(filters.maxPrice).toBe(20000);
  });

  it("includes date range when provided", () => {
    const filters = buildActivityQuery({
      dateFrom: "2026-04-15",
      dateTo: "2026-04-30",
    });
    expect(filters.dateFrom).toBe("2026-04-15");
    expect(filters.dateTo).toBe("2026-04-30");
  });

  it("includes search term when provided", () => {
    const filters = buildActivityQuery({ search: "cooking" });
    expect(filters.search).toBe("cooking");
  });

  it("defaults sort to rating (best rated)", () => {
    const filters = buildActivityQuery({});
    expect(filters.sort).toBe("rating");
  });

  it("accepts custom sort", () => {
    const filters = buildActivityQuery({ sort: "price_asc" });
    expect(filters.sort).toBe("price_asc");
  });
});
