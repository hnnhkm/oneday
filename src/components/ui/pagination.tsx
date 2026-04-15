"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getPageNumbers } from "@/lib/pagination";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

/**
 * Page navigation bar that preserves all existing URL search params
 * (filters, sort, search term) while changing only `page`.
 *
 * Renders prev/next arrows + numbered page buttons. For large page
 * counts (>7), shows the first page, last page, current ± 1, and
 * ellipsis gaps.
 *
 * When navigating to page 1, omits the `page` param for cleaner
 * URLs (page 1 is the default). Returns null when totalPages ≤ 1.
 */
export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  if (totalPages <= 1) return null;

  function buildHref(page: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-1 mt-8"
    >
      {/* Previous */}
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1) as "/activities"}
          className="px-3 py-2 rounded text-sm text-charcoal hover:bg-background-muted transition-colors"
          aria-label="Previous page"
        >
          ‹
        </Link>
      ) : (
        <span className="px-3 py-2 rounded text-sm text-charcoal-lighter/40">
          ‹
        </span>
      )}

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="px-2 py-2 text-sm text-charcoal-lighter"
          >
            ...
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p as number) as "/activities"}
            className={cn(
              "px-3 py-2 rounded text-sm font-medium transition-colors",
              p === currentPage
                ? "bg-primary-400 text-white"
                : "text-charcoal hover:bg-background-muted"
            )}
            aria-current={p === currentPage ? "page" : undefined}
          >
            {p}
          </Link>
        )
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={buildHref(currentPage + 1) as "/activities"}
          className="px-3 py-2 rounded text-sm text-charcoal hover:bg-background-muted transition-colors"
          aria-label="Next page"
        >
          ›
        </Link>
      ) : (
        <span className="px-3 py-2 rounded text-sm text-charcoal-lighter/40">
          ›
        </span>
      )}
    </nav>
  );
}

/**
 * Compute which page numbers to show. For ≤ 7 total pages, show
 * all. Otherwise show first, last, current ± 1, with "..." gaps.
 */
