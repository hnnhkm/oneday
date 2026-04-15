import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-primary-400 text-white hover:bg-primary-500 active:bg-primary-600":
              variant === "primary",
            "bg-secondary-300 text-white hover:bg-secondary-400 active:bg-secondary-500":
              variant === "secondary",
            "border-2 border-primary-400 text-primary-400 bg-transparent hover:bg-primary-50 active:bg-primary-100":
              variant === "outline",
            "text-charcoal hover:bg-background-muted active:bg-background-muted/80":
              variant === "ghost",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-5 py-2.5 text-base": size === "md",
            "px-7 py-3 text-lg": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
