import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "accent";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-primary-50 text-primary-600": variant === "default",
          "bg-secondary-50 text-secondary-600": variant === "secondary",
          "bg-accent-50 text-accent-700": variant === "accent",
        },
        className
      )}
      {...props}
    />
  );
}
