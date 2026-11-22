import { describe, it, expect } from "vitest";
import { bestBitsWithinFivePoints } from "./accuracy.js";

describe("accuracy task", () => {
  it("picks the fewest bits within 5 points of full precision", () => {
    const acc = { full: { score: 0.71 }, 16: { score: 0.71 }, 8: { score: 0.69 }, 4: { score: 0.38 } };
    expect(bestBitsWithinFivePoints(acc)).toBe(8);
  });

  it("4-bit wins if it keeps up", () => {
    const acc = { full: { score: 0.7 }, 16: { score: 0.7 }, 8: { score: 0.7 }, 4: { score: 0.67 } };
    expect(bestBitsWithinFivePoints(acc)).toBe(4);
  });

  it("no task without accuracy results", () => {
    expect(bestBitsWithinFivePoints(null)).toBe(null);
    expect(bestBitsWithinFivePoints({ 8: { score: 0.5 } })).toBe(null);
  });
});
