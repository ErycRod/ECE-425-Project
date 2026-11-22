// Challenges for the Advanced level (plain JavaScript, so they're easy to test).
// Each check gets the /api/custom_design reply for the current design
// ({ design, designs, ranking }) and returns true when the challenge is met.

// smallest value of one metric among the synthesized designs
function bestOf(designs, key) {
  let best = null;
  for (let i = 0; i < designs.length; i++) {
    const value = designs[i][key];
    if (typeof value === "number" && (best === null || value < best)) {
      best = value;
    }
  }
  return best;
}

// Challenges for the Advanced level. Each check gets the API reply for the current design
// ({ design, designs, ranking }) and ticks off when it's met.
// Beyond 24x24 (1.5x the biggest synthesized array) the hardware numbers are too far from
// anything we synthesized to trust, so challenges only count up to this size.
export const MAX_CHALLENGE_P = 24;

export function makeChallenges(reply) {
  const bestTtft = bestOf(reply.designs, "ttft_s");
  const bestEnergy = bestOf(reply.designs, "energy_J");
  return [
    {
      key: "under-30",
      bloom: "Create",
      title: "Build a design that fits the chip and gives the first word in under 30 s.",
      hint: "The first word is math-limited, so you need many PEs. Which bit width lets you fit the most PEs on the chip?",
      check: (r) => r.design.P <= MAX_CHALLENGE_P && r.design.resources.fits_zynq7020 && r.design.ttft_s < 30,
    },
    {
      key: "16-bit-best",
      bloom: "Evaluate",
      title:
        "Keep 16-bit weights and beat the fastest synthesized first word (" +
        (bestTtft === null ? "n/a" : Math.round(bestTtft) + " s") + ").",
      hint: "16-bit multipliers run fast only while they fit in the 220 DSP blocks. What's the biggest array that still does?",
      check: (r) => r.design.P <= MAX_CHALLENGE_P && r.design.bits === 16 && r.design.resources.fits_zynq7020 && bestTtft !== null &&
        r.design.ttft_s < bestTtft,
    },
    {
      key: "energy",
      bloom: "Evaluate",
      title:
        "Use less energy per answer than every synthesized design (under " +
        (bestEnergy === null ? "n/a" : bestEnergy.toFixed(1) + " J") + ") and still fit the chip.",
      hint: "Energy = power × time. A bigger array draws more power but can finish much sooner. Try 4-bit.",
      check: (r) => r.design.P <= MAX_CHALLENGE_P && r.design.resources.fits_zynq7020 && bestEnergy !== null &&
        typeof r.design.energy_J === "number" && r.design.energy_J < bestEnergy,
    },
  ];
}
