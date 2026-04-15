import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { User } from "@/lib/types/database";

export async function AdminSidebar({ user }: { user: User }) {
  const t = await getTranslations("admin.nav");

  const links: Array<{
    href:
      | "/admin"
      | "/admin/applications"
      | "/admin/users"
      | "/admin/activities"
      | "/admin/categories"
      | "/admin/audit";
    icon: string;
    label: string;
  }> = [
    { href: "/admin", icon: "📊", label: t("dashboard") },
    { href: "/admin/applications", icon: "📝", label: t("applications") },
    { href: "/admin/users", icon: "👥", label: t("users") },
    { href: "/admin/activities", icon: "🎨", label: t("activities") },
    { href: "/admin/categories", icon: "🏷️", label: t("categories") },
    { href: "/admin/audit", icon: "📋", label: t("audit") },
  ];

  return (
    <aside className="md:w-60 md:flex-shrink-0 md:border-r md:border-charcoal-lighter/10 md:min-h-[calc(100vh-4rem)] md:bg-white">
      <div className="md:p-4">
        <div className="hidden md:flex items-center gap-3 p-3 rounded-lg bg-red-50 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-semibold">
            {user.name[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-charcoal truncate">
              {user.name}
            </div>
            <div className="text-xs text-red-700">Admin</div>
          </div>
        </div>

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
