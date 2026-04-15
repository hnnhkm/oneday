import {
  formatCurrency,
  formatDate,
  formatTime,
  getTranslatedField,
  cn,
} from "@/lib/utils";

// Intl.NumberFormat uses non-breaking space (\u00a0) between R$ and the amount
const nbsp = "\u00a0";

describe("formatCurrency", () => {
  it("formats centavos to BRL currency string", () => {
    expect(formatCurrency(15000)).toBe(`R$${nbsp}150,00`);
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe(`R$${nbsp}0,00`);
  });

  it("handles small amounts", () => {
    expect(formatCurrency(99)).toBe(`R$${nbsp}0,99`);
  });
});

describe("formatDate", () => {
  it("formats date in Portuguese by default", () => {
    const result = formatDate("2026-04-15", "pt");
    expect(result).toContain("15");
    expect(result).toContain("abr");
  });

  it("formats date in English", () => {
    const result = formatDate("2026-04-15", "en");
    expect(result).toContain("15");
    expect(result).toContain("Apr");
  });

  it("accepts a full ISO timestamp and uses the date portion", () => {
    // Regression: callers that pass users.created_at (a full
    // TIMESTAMPTZ from Postgres) were getting "Invalid Date"
    // because the old impl blindly appended "T00:00:00" to the
    // already-timestamped string.
    const result = formatDate("2026-04-15T14:30:00.123Z", "pt");
    expect(result).toContain("15");
    expect(result).toContain("abr");
    expect(result).not.toContain("Invalid");
  });

  it("returns empty string for empty or missing input", () => {
    expect(formatDate("", "pt")).toBe("");
  });
});

describe("formatTime", () => {
  it("formats 24h time string", () => {
    expect(formatTime("14:30")).toBe("14:30");
  });
});

describe("getTranslatedField", () => {
  const field = { pt: "Culinária", en: "Cooking", es: "Cocina" };

  it("returns field in requested locale", () => {
    expect(getTranslatedField(field, "en")).toBe("Cooking");
  });

  it("falls back to Portuguese if locale missing", () => {
    const partial = { pt: "Culinária" };
    expect(getTranslatedField(partial, "en")).toBe("Culinária");
  });

  it("returns empty string for null/undefined", () => {
    expect(getTranslatedField(null, "pt")).toBe("");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("px-4", false && "hidden", "py-2")).toBe("px-4 py-2");
  });

  it("deduplicates tailwind conflicts", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });
});
