import { cn } from "@/lib/utils";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-background-card shadow-card transition-shadow hover:shadow-card-hover",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return <div className={cn("p-4 pb-2", className)} {...props} />;
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("p-4 pt-0 flex items-center justify-between", className)}
      {...props}
    />
  );
}
