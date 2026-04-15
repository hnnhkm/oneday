import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/lib/types/database";

/**
 * Server-side guard for every `/admin/*` page. Mirrors
 * `requireApprovedInstructor()` for the staff side.
 *
 * Not-logged-in → /login.
 * Logged-in but not admin → /404 via notFound() would feel
 * punitive; redirect them home instead so we don't leak that
 * /admin/* exists. The spec's defense-in-depth intent is that
 * admin actions are gated by RLS (role='admin' policies already
 * exist on most tables) AND by this server-side check.
 */
export async function requireAdmin(): Promise<User> {
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect(`/${locale}/login`);
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!userRow || (userRow as User).role !== "admin") {
    redirect(`/${locale}`);
  }

  return userRow as User;
}

/**
 * Lighter-weight check used by the header / user-menu to decide
 * whether to surface the admin nav link. Doesn't redirect.
 */
export async function isAdminUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return false;

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  return (data as { role: string } | null)?.role === "admin";
}
