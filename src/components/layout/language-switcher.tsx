"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { routing, type Locale } from "@/i18n/routing";
import { useState, useRef, useEffect } from "react";

const localeLabels: Record<Locale, string> = {
  pt: "PT",
  en: "EN",
  es: "ES",
};

const localeFull: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchLocale(newLocale: Locale) {
    router.replace(pathname, { locale: newLocale });
    setOpen(false);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium text-charcoal hover:bg-background-muted transition-colors"
        aria-label="Change language"
      >
        🌐 {localeLabels[locale]}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-dropdown py-1 z-50 min-w-[140px]">
          {routing.locales.map((loc) => (
            <button
              key={loc}
              onClick={() => switchLocale(loc)}
              className={cn(
                "w-full text-left px-4 py-2 text-sm hover:bg-background-muted transition-colors",
                loc === locale && "font-semibold text-primary-400"
              )}
            >
              {localeFull[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
