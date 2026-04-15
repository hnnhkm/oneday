import { normalizeSearchTerm } from "@/lib/queries/activities";

describe("normalizeSearchTerm", () => {
  it("returns null for a single-character input", () => {
    expect(normalizeSearchTerm("a")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(normalizeSearchTerm("   ")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(normalizeSearchTerm("")).toBeNull();
  });

  it("clamps to 100 characters", () => {
    const input = "a".repeat(200);
    const result = normalizeSearchTerm(input);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(100);
  });

  it("collapses internal whitespace and trims", () => {
    expect(normalizeSearchTerm("  sushi    roll  ")).toBe("sushi roll");
  });

  it("preserves websearch_to_tsquery operators untouched", () => {
    expect(normalizeSearchTerm('"cerâmica avançada" -iniciante')).toBe(
      '"cerâmica avançada" -iniciante'
    );
  });

  it("preserves accented characters", () => {
    expect(normalizeSearchTerm("cerâmica")).toBe("cerâmica");
  });

  it("passes through multi-word queries as-is (modulo whitespace)", () => {
    expect(normalizeSearchTerm("sushi roll")).toBe("sushi roll");
  });
});
