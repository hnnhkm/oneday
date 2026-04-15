import { cn } from "@/lib/utils";
import Image from "next/image";

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
};

const pixelMap = { sm: 32, md: 40, lg: 64 };

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={pixelMap[size]}
        height={pixelMap[size]}
        className={cn("rounded-full object-cover", sizeMap[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-semibold",
        sizeMap[size],
        className
      )}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  );
}
