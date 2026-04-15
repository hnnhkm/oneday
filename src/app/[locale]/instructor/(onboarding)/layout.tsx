/**
 * Route-group layout that overrides the parent /instructor layout for
 * apply/pending/rejected pages. These pages can't use
 * `requireApprovedInstructor()` (that's the whole point — they run
 * BEFORE the user is approved), so the dashboard sidebar is swapped for
 * a simple centered container.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10 md:py-16">{children}</div>
  );
}
