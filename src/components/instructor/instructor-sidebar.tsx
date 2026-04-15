import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { InstructorProfile, User } from "@/lib/types/database";

interface SidebarProps {
  user: User;
  profile: InstructorProfile;
}

export async function InstructorSidebar({ user }: SidebarProps) {
  const t = await getTranslations("instructor.nav");

  const links: Array<{
    href:
      | "/instructor"
      | "/instructor/activities"
      | "/instructor/bookings"
      | "/instructor/notifications"
      | "/instructor/payouts"
      | "/instructor/profile";
    icon: string;
    label: string;
  }> = [
    { href: "/instructor", icon: "📊", label: t("dashboard") },
    {
      href: "/instructor/activities",
      icon: "🎨",
      label: t("myActivities"),
    },
    { href: "/instructor/bookings", icon: "🎟️", label: t("bookings") },
    {
      href: "/instructor/notifications",
      icon: "🔔",
      label: t("notifications"),
    },
    { href: "/instructor/payouts", icon: "💰", label: t("payouts") },
    { href: "/instructor/profile", icon: "👤", label: t("profile") },
  ];

  return (
    <aside className="md:w-60 md:flex-shrink-0 md:border-r md:border-charcoal-lighter/10 md:min-h-[calc(100vh-4rem)] md:bg-white">
      <div className="md:p-4">
        {/* User card (desktop only) */}
        <div className="hidden md:flex items-center gap-3 p-3 rounded-lg bg-background-muted mb-4">
          <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-semibold">
            {user.name[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-charcoal truncate">
              {user.name}
            </div>
            <div className="text-xs text-charcoal-lighter truncate">
              {user.email}
            </div>
          </div>
        </div>

        {/* Nav — horizontal tabs on mobile, vertical on desktop */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible border-b md:border-b-0 border-charcoal-lighter/10 px-2 md:px-0">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-charcoal hover:bg-background-muted rounded-md whitespace-nowrap"
            >
              <span aria-hidden>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="hidden md:block mt-6 pt-4 border-t border-charcoal-lighter/10">
          <Link
            href="/"
            className="text-sm text-charcoal-lighter hover:text-charcoal"
          >
            {t("backToSite")}
          </Link>
        </div>
      </div>
    </aside>
  );
}
