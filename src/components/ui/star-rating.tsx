import { cn } from "@/lib/utils";

export interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md";
  showCount?: boolean;
  count?: number;
  className?: string;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = "sm",
  showCount = false,
  count = 0,
  className,
}: StarRatingProps) {
  const stars = Array.from({ length: maxRating }, (_, i) => {
    const filled = i < Math.floor(rating);
    const halfFilled = !filled && i < rating;

    return (
      <span
        key={i}
        className={cn(
          filled
            ? "text-accent-400"
            : halfFilled
              ? "text-accent-300"
              : "text-charcoal-lighter/30",
          size === "sm" ? "text-sm" : "text-lg"
        )}
        aria-hidden="true"
      >
        ★
      </span>
    );
  });

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {stars}
      {showCount && (
        <span className="ml-1 text-xs text-charcoal-lighter">({count})</span>
      )}
    </div>
  );
}
