/**
 * Quorum status for a time-slot card.
 *
 * The mapping from (min, booked, state) to a badge variant lives
 * here so the UI has exactly one source of truth for which
 * indicator to show. The cards just render whatever this returns.
 *
 * The "silent at 3+ away" threshold is intentional: showing "0/5"
 * or "1/5" on a sparse-looking session creates a self-fulfilling
 * prophecy where the visible emptiness discourages booking. We
 * only surface progress when it's motivating ("only 2 more needed")
 * or informative ("✓ Confirmed").
 */
import type { QuorumState } from "@/lib/types/database";
export type { QuorumState };

export type QuorumStatus =
  | { kind: "none" }
  | { kind: "confirmed" }
  | { kind: "at_risk" }
  | { kind: "close"; needed: number }
  | { kind: "silent" };

export function getQuorumStatus(
  min: number,
  booked: number,
  state: QuorumState
): QuorumStatus {
  // Feature disabled at the activity level, or session already
  // cancelled (UI handles that via the existing cancelled path).
  if (min === 0 || state === "cancelled") return { kind: "none" };

  // Confirmed takes precedence over booked count — once the system
  // or instructor says confirmed, we commit to that message.
  if (state === "confirmed" || booked >= min) return { kind: "confirmed" };

  if (state === "at_risk") return { kind: "at_risk" };

  const needed = min - booked;
  if (needed <= 2) return { kind: "close", needed };
  return { kind: "silent" };
}
