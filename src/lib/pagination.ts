/**
 * Compute which page numbers to display in a pagination bar.
 *
 * For ≤ 7 total pages, returns all numbers. For larger counts,
 * shows the first page, last page, current ± 1, with "..." gaps.
 *
 * Pure function — no React, no Next.js, unit-testable.
 */
export function getPageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    pages.add(i);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | "...")[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("...");
    }
    result.push(sorted[i]);
  }

  return result;
}
