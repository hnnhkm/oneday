"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  isApprovedInstructor?: boolean;
}

const baseItems = [
  { href: "/", labelKey: "home", icon: "🏠" },
  { href: "/activities", labelKey: "browse", icon: "🔍" },
  { href: "/bookings", labelKey: "bookings", icon: "📋" },
  { href: "/settings", labelKey: "profile", icon: "👤" },
] as const;

const instructorItem = {
  href: "/instructor" as const,
  labelKey: "instructorNav" as const,
  icon: "🎨",
};

export function MobileNav({ isApprovedInstructor = false }: MobileNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const navItems = isApprovedInstructor
    ? [...baseItems.slice(0, 3), instructorItem, baseItems[3]]
    : baseItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-charcoal-lighter/10 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs transition-colors",
                isActive
                  ? "text-primary-400 font-semibold"
                  : "text-charcoal-lighter"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
