import { canUserBookActivity } from "@/lib/activity-validation";

describe("canUserBookActivity", () => {
  const BOOKER = "11111111-1111-1111-1111-111111111111";
  const OTHER_INSTRUCTOR = "22222222-2222-2222-2222-222222222222";

  it("returns null when the booker is different from the instructor", () => {
    expect(
      canUserBookActivity({ userId: BOOKER, instructorUserId: OTHER_INSTRUCTOR })
    ).toBeNull();
  });

  it("returns an error when the booker IS the instructor", () => {
    expect(
      canUserBookActivity({ userId: BOOKER, instructorUserId: BOOKER })
    ).toEqual({ reason: "own_activity" });
  });

  it("returns null when the instructor user id is unknown (no profile join)", () => {
    // Defensive: if we somehow don't know the owner, we let the
    // SQL layer catch the self-book case rather than producing a
    // false positive.
    expect(
      canUserBookActivity({ userId: BOOKER, instructorUserId: null })
    ).toBeNull();
  });

  it("returns an error when the booker is not authenticated", () => {
    expect(
      canUserBookActivity({ userId: null, instructorUserId: OTHER_INSTRUCTOR })
    ).toEqual({ reason: "not_authenticated" });
  });
});
