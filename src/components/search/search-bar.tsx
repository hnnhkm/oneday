"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  defaultValue?: string;
  className?: string;
  size?: "sm" | "lg";
}

export function SearchBar({
  defaultValue = "",
  className,
  size = "sm",
}: SearchBarProps) {
  const t = useTranslations("home");
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/activities?search=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/activities");
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className={cn(
          "w-full rounded-full border border-charcoal-lighter/20 bg-white text-charcoal placeholder:text-charcoal-lighter/60 transition-all focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent",
          size === "lg"
            ? "px-4 py-2.5 text-sm pr-12 sm:px-6 sm:py-4 sm:text-lg sm:pr-14"
            : "px-4 py-2.5 text-sm pr-12"
        )}
      />
      <button
        type="submit"
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary-400 text-white hover:bg-primary-500 transition-colors flex items-center justify-center",
          size === "lg" ? "h-8 w-8 sm:h-10 sm:w-10" : "h-8 w-8"
        )}
        aria-label="Search"
      >
        <svg
          className={size === "lg" ? "h-4 w-4 sm:h-5 sm:w-5" : "h-4 w-4"}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
    </form>
  );
}
