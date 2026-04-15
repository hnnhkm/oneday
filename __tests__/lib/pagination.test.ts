import { getPageNumbers } from "@/lib/pagination";

describe("getPageNumbers", () => {
  it("returns all pages when total ≤ 7", () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns 1 for a single page", () => {
    expect(getPageNumbers(1, 1)).toEqual([1]);
  });

  it("shows ellipsis for pages > 7 when current is near the start", () => {
    const result = getPageNumbers(1, 10);
    // Should show: 1, 2, ..., 10
    expect(result).toEqual([1, 2, "...", 10]);
  });

  it("shows ellipsis for pages > 7 when current is near the end", () => {
    const result = getPageNumbers(10, 10);
    // Should show: 1, ..., 9, 10
    expect(result).toEqual([1, "...", 9, 10]);
  });

  it("shows both ellipses when current is in the middle", () => {
    const result = getPageNumbers(5, 10);
    // Should show: 1, ..., 4, 5, 6, ..., 10
    expect(result).toEqual([1, "...", 4, 5, 6, "...", 10]);
  });

  it("handles current at page 3 with gap only on the right", () => {
    const result = getPageNumbers(3, 10);
    // Should show: 1, 2, 3, 4, ..., 10
    expect(result).toEqual([1, 2, 3, 4, "...", 10]);
  });

  it("handles current at page 8 of 10 with gap only on the left", () => {
    const result = getPageNumbers(8, 10);
    // Should show: 1, ..., 7, 8, 9, 10
    expect(result).toEqual([1, "...", 7, 8, 9, 10]);
  });
});
