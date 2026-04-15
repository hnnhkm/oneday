"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toggleFavoriteAction } from "@/lib/actions/account";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  activityId: string;
  initialFavorited: boolean;
  /**
   * When true, the user isn't logged in. Clicking sends them to /login
   * instead of calling the toggle action.
   */
  requiresAuth?: boolean;
  className?: string;
  size?: "sm" | "md";
  /**
   * Visual style.
   * - `chip` (default): circular white pill with shadow. Use when the
   *   button sits on non-image chrome (e.g. the detail-page title row).
   * - `ghost`: no background — just the heart icon. The icon's stroke
   *   gets a white color + drop-shadow so it stays legible over any
   *   photo. Used on top of activity card cover images.
   */
  variant?: "chip" | "ghost";
}

export function FavoriteButton({
  activityId,
  initialFavorited,
  requiresAuth = false,
  className,
  size = "md",
  variant = "chip",
}: FavoriteButtonProps) {
  const t = useTranslations("activities");
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  const dims = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  // Ghost uses a larger icon since there's no pill backdrop to anchor
  // the tap target — the icon itself is the visual button.
  const iconSize =
    variant === "ghost"
      ? size === "sm"
        ? "h-6 w-6"
        : "h-7 w-7"
      : size === "sm"
        ? "h-4 w-4"
        : "h-5 w-5";

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (requiresAuth) {
      router.push("/login");
      return;
    }

    // Optimistic flip
    const next = !favorited;
    setFavorited(next);

    startTransition(async () => {
      const result = await toggleFavoriteAction(activityId);
      if (!result.ok) {
        // Revert on error
        setFavorited(!next);
      } else if (typeof result.favorited === "boolean") {
        setFavorited(result.favorited);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={favorited ? t("removeFromFavorites") : t("addToFavorites")}
      aria-pressed={favorited}
      className={cn(
        "flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50",
        variant === "chip"
          ? "rounded-full bg-white/90 backdrop-blur-sm shadow-card"
          : null,
        dims,
        className
      )}
    >
      <svg
        className={cn(
          iconSize,
          favorited
            ? "fill-primary-400 text-primary-400"
            : variant === "ghost"
              ? // White outline + drop shadow keeps the heart readable
                // on any image underneath without a backing pill.
                "fill-black/25 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
              : "fill-none text-charcoal"
        )}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  );
}
