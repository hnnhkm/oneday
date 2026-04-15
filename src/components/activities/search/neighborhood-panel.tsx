"use client";

import { cn } from "@/lib/utils";

interface NeighborhoodPanelProps {
  neighborhoods: string[];
  selected: string;
  onSelect: (neighborhood: string) => void;
}

export function NeighborhoodPanel({ neighborhoods, selected, onSelect }: NeighborhoodPanelProps) {
  return (
    <div className="w-full">
      <div className="space-y-1">
        {neighborhoods.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(n === selected ? "" : n)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
              n === selected
                ? "bg-background-muted font-medium text-charcoal"
                : "text-charcoal hover:bg-background-muted/60"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
