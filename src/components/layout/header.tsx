import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { UserMenu } from "./user-menu";
import { HeaderShell } from "./header-shell";
import { getUser } from "@/lib/supabase/get-user";
import { fetchUserNotifications } from "@/lib/queries/notifications";
import { fetchInstructorProfileByUserId } from "@/lib/queries/instructor";

export async function Header() {
  const t = await getTranslations("nav");
  const user = await getUser();
  const [unreadCount, instructorProfile] = user
    ? await Promise.all([
        fetchUserNotifications(user.id, 1, 1).then((r) => r.unread),
        fetchInstructorProfileByUserId(user.id),
      ])
    : [0, null];

  // Show the "Become Instructor" link only to users who could
  // still apply: no profile yet, OR a rejected profile they could
  // re-submit. Approved/pending users see the /instructor
  // dashboard/pending page via the main nav instead.
  const canBecomeInstructor =
    !!user &&
    user.role !== "admin" &&
    (!instructorProfile || instructorProfile.approval_status === "rejected");

  // Approved instructors are also regular users — they can book,
  // favorite and review like anyone else. Expose a dropdown link
  // to their instructor dashboard so they always have a way to
  // switch hats without typing the URL.
  const isApprovedInstructor =
    !!instructorProfile && instructorProfile.approval_status === "approved";

  return (
    // HeaderShell (client) sets `data-scrolled` on the <header> when
    // the page has been scrolled past the initial pixels. The inner
    // row and the logo then shrink via `group-data-[scrolled=true]:`
    // variants — gradual size reduction with a 200ms transition so
    // the header compacts smoothly instead of snapping. Translucent
    // backdrop-blur is applied on the <header> itself inside HeaderShell.
    <HeaderShell>
      <div className="mx-auto max-w-6xl px-4 flex items-center justify-center md:justify-between h-14 md:h-16 group-data-[scrolled=true]:h-11 md:group-data-[scrolled=true]:h-14 transition-[height] duration-200">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="oneday"
            className="h-7 md:h-10 group-data-[scrolled=true]:h-5 md:group-data-[scrolled=true]:h-8 transition-[height] duration-200"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6 ml-auto mr-6">
          {user && (
            <Link
              href="/bookings"
              className="text-sm font-medium text-charcoal hover:text-primary-400 transition-colors"
            >
              {t("bookings")}
            </Link>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          {user && (
            // Heart icon links to /favorites. Mirrors the heart users tap
            // on every activity card so the affordance to "see what I
            // saved" is visually identical to the affordance to save.
            // Same SVG path as FavoriteButton for visual consistency.
            // Dropdown still has a duplicate "Favorites" item for
            // keyboard-only users and anyone who misses the icon.
            <Link
              href="/favorites"
              aria-label={t("favorites")}
              title={t("favorites")}
              className="flex items-center justify-center w-9 h-9 text-charcoal hover:text-primary-400 transition-colors"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                />
              </svg>
            </Link>
          )}
          <UserMenu
            user={
              user
                ? {
                    name: user.name,
                    avatar_url: user.avatar_url,
                    role: user.role,
                  }
                : null
            }
            unreadCount={unreadCount}
            canBecomeInstructor={canBecomeInstructor}
            isApprovedInstructor={isApprovedInstructor}
          />
        </div>
      </div>
    </HeaderShell>
  );
}
