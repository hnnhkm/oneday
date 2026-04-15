"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface CarouselProps {
  children: React.ReactNode;
}

/**
 * Horizontal snap-scroll carousel with left/right arrow buttons.
 *
 * Accepts any children and lays them out in a scrollable row with
 * CSS scroll-snap. Arrow buttons appear at the edges and scroll by
 * one "page" (the container's visible width). Arrows auto-hide
 * when fully scrolled to either end.
 *
 * Responsive: children control their own widths via Tailwind
 * (e.g. `w-72 sm:w-80 flex-shrink-0`). The carousel just provides
 * the scrolling container.
 */
export function Carousel({ children }: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.clientWidth * 0.85;
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  }

  return (
    <div className="relative group">
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>

      {/* Left arrow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-charcoal hover:bg-background-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
          aria-label="Scroll left"
        >
          ‹
        </button>
      )}

      {/* Right arrow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-charcoal hover:bg-background-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
          aria-label="Scroll right"
        >
          ›
        </button>
      )}
    </div>
  );
}
