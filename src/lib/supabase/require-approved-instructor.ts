import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { InstructorProfile, User } from "@/lib/types/database";

/**
 * Server-side guard for every `/instructor/*` dashboard page.
 * Sends the viewer to the right onboarding state if they aren't a fully
 * approved instructor yet. Mirrors the server-component-first pattern
 * used by /bookings, /settings, /favorites.
 */
export async function requireApprovedInstructor(): Promise<{
  user: User;
  profile: InstructorProfile;
}> {
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

  if (!userRow) {
    redirect(`/${locale}/login`);
  }

  const { data: profile } = await supabase
    .from("instructor_profiles")
    .select("*")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (!profile) {
    redirect(`/${locale}/instructor/apply`);
  }
  if (profile.approval_status === "pending") {
    redirect(`/${locale}/instructor/pending`);
  }
  if (profile.approval_status === "rejected") {
    redirect(`/${locale}/instructor/rejected`);
  }

  return {
    user: userRow as User,
    profile: profile as InstructorProfile,
  };
}

/**
 * Lighter-weight helper used by the onboarding pages themselves to avoid
 * redirect loops. Returns the current user + their instructor profile
 * (if any). Caller decides what to render.
 */
export async function getInstructorOnboardingState(): Promise<{
  user: User | null;
  profile: InstructorProfile | null;
}> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { user: null, profile: null };
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  const { data: profile } = await supabase
    .from("instructor_profiles")
    .select("*")
    .eq("user_id", authUser.id)
    .maybeSingle();

  return {
    user: (userRow as User) ?? null,
    profile: (profile as InstructorProfile) ?? null,
  };
}
