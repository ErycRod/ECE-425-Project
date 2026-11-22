import { describe, it, expect } from "vitest";
import { makeChallenges } from "./challenges.js";

// a tiny fake /api/custom_design reply: two synthesized designs and the user's design
function reply(design) {
  return {
    design: design,
    designs: [
      { P: 16, bits: 4, ttft_s: 45.8, energy_J: 13.1 },
      { P: 16, bits: 16, ttft_s: 78.2, energy_J: 44.7 },
    ],
  };
}

function mine(P, bits, ttft, energy, fits) {
  return { P: P, bits: bits, ttft_s: ttft, energy_J: energy, resources: { fits_zynq7020: fits } };
}

describe("Advanced challenges", () => {
  it("targets come from the synthesized designs", () => {
    const list = makeChallenges(reply(mine(12, 8, 100, 30, true)));
    expect(list.length).toBe(3);
    expect(list[1].title).toContain("46 s");
    expect(list[2].title).toContain("13.1 J");
  });

  it("under 30 s only counts if the design fits", () => {
    const fast = reply(mine(24, 4, 20, 11, true));
    const tooBig = reply(mine(25, 8, 25, 40, false));
    expect(makeChallenges(fast)[0].check(fast)).toBe(true);
    expect(makeChallenges(tooBig)[0].check(tooBig)).toBe(false);
  });

  it("the 16-bit challenge needs 16-bit weights", () => {
    const sixteen = reply(mine(14, 16, 33, 14, true));
    const four = reply(mine(24, 4, 20, 11, true));
    expect(makeChallenges(sixteen)[1].check(sixteen)).toBe(true);
    expect(makeChallenges(four)[1].check(four)).toBe(false);
  });

  it("energy has to beat every synthesized design", () => {
    const low = reply(mine(20, 4, 27, 12.2, true));
    const high = reply(mine(14, 16, 33, 13.9, true));
    expect(makeChallenges(low)[2].check(low)).toBe(true);
    expect(makeChallenges(high)[2].check(high)).toBe(false);
  });
});

describe("challenge size limit", () => {
  it("designs bigger than 24x24 don't count", () => {
    const huge = reply(mine(32, 4, 11, 10, true));
    const list = makeChallenges(huge);
    expect(list[0].check(huge)).toBe(false);
    expect(list[2].check(huge)).toBe(false);
  });
});
