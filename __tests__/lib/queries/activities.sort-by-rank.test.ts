import { sortByRankAndSlice } from "@/lib/queries/activities";

type Row = { id: string; name: string };

function makeRows(...ids: string[]): Row[] {
  return ids.map((id) => ({ id, name: `row-${id}` }));
}

describe("sortByRankAndSlice", () => {
  it("orders rows by descending rank from the rank map", () => {
    const rows = makeRows("a", "b", "c");
    const ranks = new Map([
      ["a", 0.1],
      ["b", 0.9],
      ["c", 0.5],
    ]);
    const result = sortByRankAndSlice(rows, ranks, 0, 10);
    expect(result.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("treats rows missing from the rank map as rank 0 (sorted last)", () => {
    const rows = makeRows("a", "b", "c");
    const ranks = new Map([["b", 0.5]]);
    const result = sortByRankAndSlice(rows, ranks, 0, 10);
    expect(result[0]!.id).toBe("b");
    expect(new Set(result.slice(1).map((r) => r.id))).toEqual(new Set(["a", "c"]));
  });

  it("applies offset and limit after sorting", () => {
    const rows = makeRows("a", "b", "c", "d", "e");
    const ranks = new Map([
      ["a", 0.1],
      ["b", 0.9],
      ["c", 0.5],
      ["d", 0.7],
      ["e", 0.3],
    ]);
    const page1 = sortByRankAndSlice(rows, ranks, 0, 2);
    const page2 = sortByRankAndSlice(rows, ranks, 2, 2);
    expect(page1.map((r) => r.id)).toEqual(["b", "d"]);
    expect(page2.map((r) => r.id)).toEqual(["c", "e"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(sortByRankAndSlice([], new Map(), 0, 10)).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const rows = makeRows("a", "b", "c");
    const snapshot = rows.map((r) => r.id);
    const ranks = new Map([
      ["a", 0.1],
      ["b", 0.9],
      ["c", 0.5],
    ]);
    sortByRankAndSlice(rows, ranks, 0, 10);
    expect(rows.map((r) => r.id)).toEqual(snapshot);
  });

  it("returns empty when offset is past the end", () => {
    const rows = makeRows("a", "b");
    const ranks = new Map([
      ["a", 0.5],
      ["b", 0.9],
    ]);
    expect(sortByRankAndSlice(rows, ranks, 5, 10)).toEqual([]);
  });
});
