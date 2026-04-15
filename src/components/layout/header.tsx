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
            <>
              <Link
                href="/bookings"
                className="text-sm font-medium text-charcoal hover:text-primary-400 transition-colors"
              >
                {t("bookings")}
              </Link>
              <Link
                href="/favorites"
                className="text-sm font-medium text-charcoal hover:text-primary-400 transition-colors"
              >
                {t("favorites")}
              </Link>
            </>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
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
