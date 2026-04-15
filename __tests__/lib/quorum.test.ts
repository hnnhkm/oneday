import { getQuorumStatus } from "@/lib/quorum";

describe("getQuorumStatus", () => {
  it("returns 'none' when min_participants is 0", () => {
    expect(getQuorumStatus(0, 3, "pending")).toEqual({ kind: "none" });
  });

  it("returns 'confirmed' when state is 'confirmed' regardless of booked", () => {
    expect(getQuorumStatus(5, 2, "confirmed")).toEqual({ kind: "confirmed" });
    expect(getQuorumStatus(5, 6, "confirmed")).toEqual({ kind: "confirmed" });
  });

  it("returns 'confirmed' when booked >= min even if state is still pending", () => {
    // The RPC layer is eventually consistent; if booked >= min but
    // the state hasn't flipped yet, we still show confirmed.
    expect(getQuorumStatus(5, 5, "pending")).toEqual({ kind: "confirmed" });
  });

  it("returns 'at_risk' when state is 'at_risk'", () => {
    expect(getQuorumStatus(5, 2, "at_risk")).toEqual({ kind: "at_risk" });
  });

  it("returns 'confirmed' when booked >= min even if state is 'at_risk'", () => {
    // The 'confirmed' guard (state === 'confirmed' || booked >= min)
    // precedes the at_risk branch, so auto-confirm always wins.
    expect(getQuorumStatus(5, 5, "at_risk")).toEqual({ kind: "confirmed" });
  });

  it("returns 'close' when 1 or 2 spots away from min", () => {
    expect(getQuorumStatus(5, 4, "pending")).toEqual({ kind: "close", needed: 1 });
    expect(getQuorumStatus(5, 3, "pending")).toEqual({ kind: "close", needed: 2 });
  });

  it("returns 'silent' when 3+ away from min", () => {
    expect(getQuorumStatus(5, 2, "pending")).toEqual({ kind: "silent" });
    expect(getQuorumStatus(5, 0, "pending")).toEqual({ kind: "silent" });
  });

  it("returns 'none' when state is 'cancelled' (UI falls back to existing cancelled-path)", () => {
    expect(getQuorumStatus(5, 2, "cancelled")).toEqual({ kind: "none" });
  });
});
