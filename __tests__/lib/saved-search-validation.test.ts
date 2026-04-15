import {
  validateSavedSearchInput,
  type SavedSearchInput,
} from "@/lib/saved-search-validation";

const valid: SavedSearchInput = {
  name: "Yoga no Ibirapuera",
  filters: { search: "yoga", neighborhood: "Vila Mariana" },
};

describe("validateSavedSearchInput", () => {
  it("returns null for valid input", () => {
    expect(validateSavedSearchInput(valid)).toBeNull();
  });

  it("rejects empty name", () => {
    expect(validateSavedSearchInput({ ...valid, name: "" })).toEqual({
      field: "name",
      message: "Name is required",
    });
  });

  it("rejects name over 100 characters", () => {
    expect(
      validateSavedSearchInput({ ...valid, name: "x".repeat(101) })
    ).toEqual({
      field: "name",
      message: "Name must be at most 100 characters",
    });
  });

  it("trims whitespace from name before validating", () => {
    expect(
      validateSavedSearchInput({ ...valid, name: "   Yoga   " })
    ).toBeNull();
  });

  it("rejects empty filters (no criteria set)", () => {
    expect(
      validateSavedSearchInput({ ...valid, filters: {} })
    ).toEqual({
      field: "filters",
      message: "At least one filter is required",
    });
  });

  it("accepts filters with only categoryIds", () => {
    expect(
      validateSavedSearchInput({
        ...valid,
        filters: { categoryIds: ["abc"] },
      })
    ).toBeNull();
  });

  it("accepts filters with only minPrice", () => {
    expect(
      validateSavedSearchInput({
        ...valid,
        filters: { minPrice: 5000 },
      })
    ).toBeNull();
  });

  it("rejects filters where all values are empty/null", () => {
    expect(
      validateSavedSearchInput({
        ...valid,
        filters: { search: "", categoryIds: [], neighborhood: "" },
      })
    ).toEqual({
      field: "filters",
      message: "At least one filter is required",
    });
  });
});
