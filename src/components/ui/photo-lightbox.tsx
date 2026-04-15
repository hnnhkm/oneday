"use client";

import { useState, useEffect, useCallback } from "react";

interface Photo {
  id: string;
  image_url: string;
}

interface PhotoLightboxProps {
  photos: Photo[];
}

/**
 * Thumbnail strip + full-screen lightbox for review photos.
 *
 * Click a thumbnail → modal overlay with the full-size image.
 * Navigate with ←/→ arrow keys or on-screen buttons. Close with
 * Esc, clicking the backdrop, or the × button.
 *
 * Renders nothing if the photos array is empty so callers don't
 * need to gate on length.
 */
export function PhotoLightbox({ photos }: PhotoLightboxProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  const prev = useCallback(() => {
    setOpenIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);

  const next = useCallback(() => {
    setOpenIndex((i) =>
      i !== null && i < photos.length - 1 ? i + 1 : i
    );
  }, [photos.length]);

  useEffect(() => {
    if (openIndex === null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }

    // Prevent body scroll while lightbox is open.
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [openIndex, close, prev, next]);

  if (photos.length === 0) return null;

  return (
    <>
      {/* Thumbnail strip */}
      <div className="flex flex-wrap gap-2 mt-3">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="w-20 h-20 rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.image_url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Lightbox modal */}
      {openIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none z-10"
            aria-label="Close"
          >
            ×
          </button>

          {/* Previous arrow */}
          {openIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl leading-none z-10"
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}

          {/* Next arrow */}
          {openIndex < photos.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl leading-none z-10"
              aria-label="Next photo"
            >
              ›
            </button>
          )}

          {/* Full image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[openIndex].image_url}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Counter */}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
              {openIndex + 1} / {photos.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
