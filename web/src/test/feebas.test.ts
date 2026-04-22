import { describe, expect, it } from "vitest";
import { NUM_FEEBAS_SPOTS, NUM_FISHING_SPOTS, feebasTiles, pickFeebasSpotIds } from "../feebas";

describe("feebas tile selection", () => {
  it("produces 447 total fishing spots on Route 119", () => {
    expect(NUM_FISHING_SPOTS).toBe(447);
  });

  it("picks six spot ids deterministically in the 1..447 range", () => {
    const spots = pickFeebasSpotIds(0x1234);
    expect(spots).toHaveLength(NUM_FEEBAS_SPOTS);
    for (const s of spots) {
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(NUM_FISHING_SPOTS);
    }
    // Deterministic: same seed must produce the same sequence.
    expect(pickFeebasSpotIds(0x1234)).toEqual(spots);
  });

  it("different seeds produce different sequences", () => {
    expect(pickFeebasSpotIds(0)).not.toEqual(pickFeebasSpotIds(1));
  });

  it("resolves duplicates into a unique (x, y) set", () => {
    const { spots, unique } = feebasTiles(0x1234);
    expect(unique.length).toBeLessThanOrEqual(spots.length);
    for (const t of unique) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
    }
  });
});
