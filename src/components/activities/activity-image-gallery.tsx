"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ActivityImageGalleryProps {
  coverImage: string;
  galleryImages: string[];
  title: string;
}

export function ActivityImageGallery({
  coverImage,
  galleryImages,
  title,
}: ActivityImageGalleryProps) {
  const allImages = [coverImage, ...galleryImages];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const hasMultiple = allImages.length > 1;

  const prev = () =>
    setSelectedIndex((i) => (i - 1 + allImages.length) % allImages.length);
  const next = () =>
    setSelectedIndex((i) => (i + 1) % allImages.length);

  // Swipe/drag state
  const startX = useRef<number | null>(null);

  function handleStart(clientX: number) {
    startX.current = clientX;
  }

  function handleEnd(clientX: number) {
    if (startX.current === null) return;
    const diff = startX.current - clientX;
    startX.current = null;
    if (Math.abs(diff) < 40) return;
    if (diff > 0) next();
    else prev();
  }

  return (
    <div>
      {/* Main image with slider */}
      <div
        className="relative aspect-[16/9] rounded-lg overflow-hidden mb-3 group select-none"
        style={{ touchAction: "pan-y" }}
        onMouseDown={(e) => {
          // Only track drag on the image area, not on buttons
          if ((e.target as HTMLElement).closest("button")) return;
          e.preventDefault();
          handleStart(e.clientX);
        }}
        onMouseUp={(e) => handleEnd(e.clientX)}
        onMouseLeave={() => { startX.current = null; }}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          handleStart(e.touches[0].clientX);
        }}
        onTouchEnd={(e) => handleEnd(e.changedTouches[0].clientX)}
      >
        {allImages.map((img, i) => (
          <div
            key={img + i}
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              i === selectedIndex ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <Image
              src={img}
              alt={`${title} ${i + 1}`}
              fill
              className="object-cover pointer-events-none"
              sizes="(max-width: 768px) 100vw, 60vw"
              priority={i === 0}
              draggable={false}
            />
          </div>
        ))}

        {/* Prev/Next arrows — desktop hover only */}
        {hasMultiple && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white hidden md:flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white hidden md:flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          </>
        )}

        {/* Dots */}
        {hasMultiple && (
          <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
            {allImages.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedIndex(i)}
                aria-label={`Go to image ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === selectedIndex
                    ? "w-5 bg-white"
                    : "w-1.5 bg-white/50 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails (desktop only) */}
      {hasMultiple && (
        <div className="hidden sm:flex gap-2 overflow-x-auto pb-2">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={cn(
                "relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border-2 transition-colors",
                i === selectedIndex
                  ? "border-primary-400"
                  : "border-transparent hover:border-charcoal-lighter/30"
              )}
            >
              <Image
                src={img}
                alt={`${title} ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
