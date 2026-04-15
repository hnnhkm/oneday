import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TranslatedField, PreferredLanguage } from "@/lib/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDate(dateStr: string, locale: string = "pt"): string {
  if (!dateStr) return "";
  const localeMap: Record<string, string> = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
  };
  // Accept either a bare YYYY-MM-DD (from DATE columns) or a full
  // ISO timestamp (from TIMESTAMPTZ columns like users.created_at).
  // For the bare form we append T00:00:00 so Date parses it in
  // local time rather than UTC — otherwise April 15 in Brazil
  // rolls back to April 14 in ISO UTC midnight. For the timestamp
  // form we take the date portion before the 'T' and apply the
  // same local-time trick.
  const datePart = dateStr.includes("T") ? dateStr.slice(0, 10) : dateStr;
  const date = new Date(datePart + "T00:00:00");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(localeMap[locale] || "pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

/**
 * Format a duration given in minutes as an hour-based string.
 * Instructors can only enter half-hour increments, so the only
 * fractional part we ever expect is 30 minutes.
 *
 *   30  -> "0h30"
 *   60  -> "1h"
 *   90  -> "1h30"
 *   120 -> "2h"
 */
export function formatDurationHours(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (remainder === 0) return `${hours}h`;
  // Pad single-digit minutes (e.g. 5) just in case future inputs allow it.
  const mm = remainder < 10 ? `0${remainder}` : String(remainder);
  return `${hours}h${mm}`;
}

export function getTranslatedField(
  field: TranslatedField | null | undefined,
  locale: PreferredLanguage | string
): string {
  if (!field) return "";
  const value = field[locale as keyof TranslatedField];
  if (value) return value;
  return field.pt || "";
}
