"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface HeroCarouselSlide {
  src: string;
  alt: string;
}

interface HeroCarouselProps {
  slides: HeroCarouselSlide[];
  intervalMs?: number;
  children: React.ReactNode;
}

export function HeroCarousel({
  slides,
  intervalMs = 5000,
  children,
}: HeroCarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      intervalMs
    );
    return () => clearInterval(id);
  }, [slides.length, intervalMs]);

  return (
    <section className="relative">
      {/* Slides — isolated to clip images only, not foreground content */}
      <div className="absolute inset-0 overflow-hidden">
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000",
              i === index ? "opacity-100" : "opacity-0"
            )}
            aria-hidden={i !== index}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={i === 0}
              className="object-cover"
              sizes="100vw"
            />
          </div>
        ))}
        {/* Dark overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60" />
      </div>

      <div className="relative h-[420px] md:h-[520px]">
        {/* Foreground content — intentionally no z-index so the search
            bar's popovers (z-40) can escape this sub-tree and stack
            above the carousel dots/nav (z-20) below. Document order
            already puts this above the absolute background layer. */}
        <div className="relative h-full flex items-center pb-14 md:pb-10">
          <div className="mx-auto max-w-4xl w-full px-12 sm:px-16 md:px-4 text-center text-white">
            {children}
          </div>
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index ? "w-8 bg-white" : "w-2 bg-white/50"
                )}
              />
            ))}
          </div>
        )}

        {/* Prev/Next */}
        {slides.length > 1 && (
          <>
            <button
              onClick={() =>
                setIndex((i) => (i - 1 + slides.length) % slides.length)
              }
              aria-label="Previous slide"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white text-sm leading-none flex items-center justify-center transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              aria-label="Next slide"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white text-sm leading-none flex items-center justify-center transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          </>
        )}
      </div>
    </section>
  );
}
