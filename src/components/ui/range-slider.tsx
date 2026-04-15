"use client";

import { useCallback, useMemo } from "react";

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
  format?: (n: number) => string;
  ariaMinLabel?: string;
  ariaMaxLabel?: string;
}

/**
 * Dual-handle range slider built from two overlapping native
 * <input type="range">. The lower handle's z-index is bumped when
 * the thumbs collide so it remains draggable from the left edge.
 * Track fill renders via a gradient on a pseudo-element.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  format = (n) => String(n),
  ariaMinLabel,
  ariaMaxLabel,
}: RangeSliderProps) {
  const [lo, hi] = value;

  // Guard against inverted bounds from the DB (e.g. all rows have
  // the same value): widen to [min, min + step] so the slider is
  // still rendered and not zero-width.
  const effectiveMax = max > min ? max : min + step;

  const pctLo = useMemo(
    () => ((lo - min) / (effectiveMax - min)) * 100,
    [lo, min, effectiveMax]
  );
  const pctHi = useMemo(
    () => ((hi - min) / (effectiveMax - min)) * 100,
    [hi, min, effectiveMax]
  );

  const handleLo = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Math.min(Number(e.target.value), hi);
      onChange([next, hi]);
    },
    [hi, onChange]
  );

  const handleHi = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Math.max(Number(e.target.value), lo);
      onChange([lo, next]);
    },
    [lo, onChange]
  );

  return (
    <div className="w-full select-none">
      {/* Label row — text-xs keeps the numeric min/max readings
          unobtrusive inside compact filter cards. */}
      <div className="flex items-center justify-between text-[13px] text-charcoal mb-3">
        <span className="font-medium">{format(lo)}</span>
        <span className="font-medium">{format(hi)}</span>
      </div>

      {/* Track + thumbs */}
      <div className="relative h-6">
        {/* Gray base track */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 rounded-full bg-charcoal-lighter/20" />
        {/* Active fill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-charcoal"
          style={{ left: `${pctLo}%`, right: `${100 - pctHi}%` }}
        />
        {/* Low handle */}
        <input
          type="range"
          min={min}
          max={effectiveMax}
          step={step}
          value={lo}
          onChange={handleLo}
          aria-label={ariaMinLabel}
          className="range-thumb absolute inset-0 w-full h-6 appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: pctLo > 90 ? 4 : 3 }}
        />
        {/* High handle */}
        <input
          type="range"
          min={min}
          max={effectiveMax}
          step={step}
          value={hi}
          onChange={handleHi}
          aria-label={ariaMaxLabel}
          className="range-thumb absolute inset-0 w-full h-6 appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: 4 }}
        />
      </div>

      <style jsx>{`
        .range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          background: #fff;
          border: 2px solid #222;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
          cursor: pointer;
        }
        .range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          background: #fff;
          border: 2px solid #222;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
          cursor: pointer;
        }
        .range-thumb::-webkit-slider-runnable-track {
          background: transparent;
        }
        .range-thumb::-moz-range-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
