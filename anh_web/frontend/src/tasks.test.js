import { describe, it, expect } from "vitest";
import { agreementSummary, bestBitsWithinFivePoints } from "./accuracy.js";

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

describe("Accuracy agreement", () => {
  it("counts identical answers and spots balanced flips", () => {
    const acc = {
      n: 100, order: ["full", "16", "8", "4"],
      full: { score: 0.5, label: "Full precision" }, 16: { score: 0.5, label: "16-bit" },
      8: { score: 0.5, label: "8-bit" }, 4: { score: 0.2, label: "4-bit" },
      agreement: { 16: { same: 97, lost: 1, gained: 1 }, 8: { same: 93, lost: 1, gained: 1 }, 4: { same: 19, lost: 34, gained: 4 } },
    };
    const s = agreementSummary(acc);
    expect(s.parts.map((p) => p.same)).toEqual([97, 93, 19]);
    expect(s.balanced).toEqual(["16-bit", "8-bit"]);
    expect(agreementSummary({ n: 100 })).toBe(null);
  });
});
