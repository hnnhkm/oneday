import { validateReview } from "@/lib/queries/reviews";

describe("validateReview", () => {
  it("accepts a valid 1-5 integer rating with empty comment", () => {
    expect(validateReview({ rating: 5, comment: "" })).toBeNull();
    expect(validateReview({ rating: 1 })).toBeNull();
  });

  it("accepts a valid rating with a non-empty comment", () => {
    expect(
      validateReview({ rating: 4, comment: "Great class, learned a lot!" })
    ).toBeNull();
  });

  it("rejects ratings outside 1-5", () => {
    expect(validateReview({ rating: 0 })?.field).toBe("rating");
    expect(validateReview({ rating: 6 })?.field).toBe("rating");
    expect(validateReview({ rating: -1 })?.field).toBe("rating");
  });

  it("rejects non-integer ratings", () => {
    expect(validateReview({ rating: 3.5 })?.field).toBe("rating");
  });

  it("rejects missing/non-numeric ratings", () => {
    expect(validateReview({})?.field).toBe("rating");
    // @ts-expect-error - testing runtime validation
    expect(validateReview({ rating: "5" })?.field).toBe("rating");
  });

  it("rejects comments longer than 2000 chars", () => {
    expect(
      validateReview({ rating: 5, comment: "x".repeat(2001) })?.field
    ).toBe("comment");
  });

  it("accepts comments at exactly 2000 chars", () => {
    expect(
      validateReview({ rating: 5, comment: "x".repeat(2000) })
    ).toBeNull();
  });
});
