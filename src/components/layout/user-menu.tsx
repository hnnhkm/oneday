"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

interface UserMenuProps {
  user: {
    name: string;
    avatar_url: string | null;
    role?: string;
  } | null;
  unreadCount?: number;
  canBecomeInstructor?: boolean;
  /**
   * True when the signed-in user has an approved instructor profile,
   * so the dropdown should expose a "switch to instructor dashboard"
   * link. Distinct from canBecomeInstructor (which targets users who
   * *don't* yet have an approved profile).
   */
  isApprovedInstructor?: boolean;
}

export function UserMenu({
  user,
  unreadCount = 0,
  canBecomeInstructor = false,
  isApprovedInstructor = false,
}: UserMenuProps) {
  const t = useTranslations("nav");
  const router = useRouter();
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

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login">
          <Button variant="ghost" size="sm">
            {t("login")}
          </Button>
        </Link>
        <Link href="/signup">
          <Button size="sm">{t("signup")}</Button>
        </Link>
      </div>
    );
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity relative"
      >
        <Avatar src={user.avatar_url} name={user.name} size="sm" />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} ${t("notifications")}`}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-dropdown py-2 z-50 min-w-[180px]">
          <p className="px-4 py-1 text-sm font-medium truncate">{user.name}</p>
          <div className="border-t border-charcoal-lighter/10 my-1" />
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="block px-4 py-2 text-sm text-red-600 font-medium hover:bg-background-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              ⚙️ {t("admin")}
            </Link>
          )}
          {isApprovedInstructor && (
            <Link
              href="/instructor"
              className="block px-4 py-2 text-sm text-primary-500 font-medium hover:bg-background-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              🎨 {t("instructorDashboard")}
            </Link>
          )}
          {canBecomeInstructor && (
            <Link
              href="/instructor/apply"
              className="block px-4 py-2 text-sm text-primary-500 font-medium hover:bg-background-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              🎨 {t("becomeInstructor")}
            </Link>
          )}
          <Link
            href="/notifications"
            className="flex items-center justify-between px-4 py-2 text-sm hover:bg-background-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            <span>{t("notifications")}</span>
            {unreadCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/settings"
            className="block px-4 py-2 text-sm hover:bg-background-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            {t("settings")}
          </Link>
          <Link
            href="/bookings"
            className="block px-4 py-2 text-sm hover:bg-background-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            {t("bookings")}
          </Link>
          <Link
            href="/favorites"
            className="block px-4 py-2 text-sm hover:bg-background-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            {t("favorites")}
          </Link>
          <div className="border-t border-charcoal-lighter/10 my-1" />
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-background-muted transition-colors"
          >
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
