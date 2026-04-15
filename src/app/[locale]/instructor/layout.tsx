import { getInstructorOnboardingState } from "@/lib/supabase/require-approved-instructor";
import { InstructorSidebar } from "@/components/instructor/instructor-sidebar";

/**
 * Shell for everything under /instructor/*. Crucially, this layout must
 * NOT call requireApprovedInstructor() — that would redirect pending
 * users to /instructor/pending (whose layout is this one, via the
 * `(onboarding)` route group), causing a loop.
 *
 * Instead, each dashboard page calls requireApprovedInstructor() itself
 * at the top of its server component. This layout just conditionally
 * renders the sidebar when the user is already approved, so the
 * onboarding pages come out as a plain centered view.
 */
export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getInstructorOnboardingState();

  const approved = profile?.approval_status === "approved";
  if (!approved || !user || !profile) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col md:flex-row">
      <InstructorSidebar user={user} profile={profile} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
