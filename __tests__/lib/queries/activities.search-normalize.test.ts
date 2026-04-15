import { normalizeSearchTerm } from "@/lib/queries/activities";

describe("normalizeSearchTerm", () => {
  it("collapses runs of whitespace", () => {
    expect(normalizeSearchTerm("  sushi   pizza  ")).toBe("sushi pizza");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeSearchTerm("  cerâmica  ")).toBe("cerâmica");
  });

  it("preserves accented characters for downstream f_unaccent", () => {
    expect(normalizeSearchTerm("cerâmica")).toBe("cerâmica");
  });

  it("preserves websearch_to_tsquery operators the user typed", () => {
    expect(normalizeSearchTerm('"cerâmica iniciante"')).toBe('"cerâmica iniciante"');
    expect(normalizeSearchTerm("cerâmica -iniciante")).toBe("cerâmica -iniciante");
    expect(normalizeSearchTerm("sushi OR pizza")).toBe("sushi OR pizza");
  });

  it("returns null for strings shorter than 2 chars after trimming", () => {
    expect(normalizeSearchTerm("a")).toBeNull();
    expect(normalizeSearchTerm("   ")).toBeNull();
    expect(normalizeSearchTerm("")).toBeNull();
  });

  it("clamps length to 100 characters", () => {
    const long = "cerâmica ".repeat(50);
    const result = normalizeSearchTerm(long);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(100);
  });
});
