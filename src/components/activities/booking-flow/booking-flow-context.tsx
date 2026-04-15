"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ActivitySessionSummary } from "@/lib/queries/activities";

/**
 * Shared selection state for the two-part booking UI:
 *
 *   - `SessionPicker` (left column) — calendar strip + time-slot grid
 *   - `BookingForm`   (right sidebar) — seats + submit
 *
 * Both mount under this provider so they read/write the same
 * `selectedSessionId` without having to lift state up through the
 * activity detail page, which is a server component. A React
 * context is the lightest glue here: no extra dependency, and the
 * provider is just a client boundary wrapping both columns.
 */
interface BookingFlowValue {
  sessions: ActivitySessionSummary[];
  /**
   * Sessions the user can actually book right now — published,
   * future, seats > 0 — sorted ascending by start. The picker seeds
   * its default selection from `bookable[0]`, and the seats `<select>`
   * in BookingForm bounds its max to the selected session's
   * remaining seats (so it stays honest if the user switches to a
   * session with fewer seats).
   */
  bookable: ActivitySessionSummary[];
  minParticipants: number;
  selectedSessionId: string | null;
  setSelectedSessionId: (id: string | null) => void;
  selectedSession: ActivitySessionSummary | null;
}

const BookingFlowContext = createContext<BookingFlowValue | null>(null);

export function BookingFlowProvider({
  sessions,
  minParticipants,
  children,
}: {
  sessions: ActivitySessionSummary[];
  minParticipants: number;
  children: React.ReactNode;
}) {
  const bookable = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter(
        (s) =>
          s.status === "published" &&
          new Date(s.starts_at).getTime() > now &&
          s.seats_remaining > 0
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );
  }, [sessions]);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    bookable[0]?.id ?? null
  );

  // If `bookable` changes underneath us (e.g. a session's start
  // time just passed while the page sat idle) and the current
  // selection is no longer in the list, snap back to the first
  // bookable session. Without this the BookingForm ends up with a
  // stale sessionId and the seats `<select>` renders a blank value
  // because its options don't include the stale seat count.
  useEffect(() => {
    if (
      selectedSessionId &&
      !bookable.some((s) => s.id === selectedSessionId)
    ) {
      setSelectedSessionId(bookable[0]?.id ?? null);
    }
  }, [bookable, selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const value = useMemo<BookingFlowValue>(
    () => ({
      sessions,
      bookable,
      minParticipants,
      selectedSessionId,
      setSelectedSessionId,
      selectedSession,
    }),
    [sessions, bookable, minParticipants, selectedSessionId, selectedSession]
  );

  return (
    <BookingFlowContext.Provider value={value}>
      {children}
    </BookingFlowContext.Provider>
  );
}

export function useBookingFlow() {
  const ctx = useContext(BookingFlowContext);
  if (!ctx) {
    throw new Error(
      "useBookingFlow must be used inside <BookingFlowProvider>"
    );
  }
  return ctx;
}
