import { cn } from "@/lib/utils";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      className={cn(
        "animate-spin rounded-full border-2 border-charcoal-lighter/20 border-t-primary-400",
        {
          "h-4 w-4": size === "sm",
          "h-8 w-8": size === "md",
          "h-12 w-12": size === "lg",
        },
        className
      )}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
