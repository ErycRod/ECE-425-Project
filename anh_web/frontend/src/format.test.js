import { describe, it, expect } from "vitest";
import {
  formatSeconds,
  formatRate,
  formatRatio,
  designLabel,
  findDesign,
  ratio,
  compareText,
} from "./format.js";

// numbers below are from perf/perf_model.py's table (each design's Vivado Fmax, 1 GB/s, placeholder profile)

describe("formatting", () => {
  it("rounds seconds to 2 decimals", () => {
    expect(formatSeconds(28.2749)).toBe("28.27");
    expect(formatSeconds(5.73)).toBe("5.73");
  });

  it("rounds tokens/s to 1 decimal", () => {
    expect(formatRate(14.8148)).toBe("14.8");
    expect(formatRate(3.7037)).toBe("3.7");
  });

  it("shows n/a for missing values, not 0", () => {
    expect(formatSeconds(null)).toBe("n/a");
    expect(formatRate(undefined)).toBe("n/a");
    expect(formatRatio(null)).toBe("n/a");
  });

  it("labels all 9 designs", () => {
    expect(designLabel(1, 4, 16)).toBe("Design 1 · 4×4 · 16-bit");
    expect(designLabel(5, 8, 8)).toBe("Design 5 · 8×8 · 8-bit");
    expect(designLabel(9, 16, 4)).toBe("Design 9 · 16×16 · 4-bit");
  });
});

describe("comparison with a baseline design", () => {
  it("finds a design in sweep data by P and bits", () => {
    const sweep = {
      designs: [
        { design: 1, P: 4, bits: 16 },
        { design: 7, P: 4, bits: 4 },
        { design: 9, P: 16, bits: 4 },
      ],
    };
    expect(findDesign(sweep, 4, 16).design).toBe(1);
    expect(findDesign(sweep, 4, 4).design).toBe(7);
    expect(findDesign(sweep, 8, 8)).toBe(null);
    expect(findDesign(null, 4, 16)).toBe(null);
  });

  it("ratio gives null when a value is missing or zero", () => {
    expect(ratio(10, 2)).toBe(5);
    expect(ratio(null, 2)).toBe(null);
    expect(ratio(10, 0)).toBe(null);
  });

  it("16x16/4-bit TTFT is 15.6x faster than 4x4/4-bit (51.14 s vs 3.27 s)", () => {
    expect(compareText("time", 3.27, 51.14, false, "4×4/4-bit")).toBe("15.6× faster than 4×4/4-bit");
  });

  it("names the baseline it compares with", () => {
    expect(compareText("time", 5.73, 28.27, false, "4×4/16-bit")).toBe("4.9× faster than 4×4/16-bit");
    expect(compareText("time", 51.14, 51.14, true, "4×4/4-bit")).toBe("baseline (4×4/4-bit)");
  });

  it("tokens/s: higher, same and baseline", () => {
    expect(compareText("rate", 14.8, 3.7, false, "4×4/16-bit")).toBe("4.0× higher than 4×4/16-bit");
    expect(compareText("rate", 3.7, 3.7, false, "4×4/16-bit")).toBe("same as 4×4/16-bit");
    expect(compareText("rate", 3.7, 3.7, true, "4×4/16-bit")).toBe("baseline (4×4/16-bit)");
  });

  it("says slower or lower when worse", () => {
    expect(compareText("time", 20, 10, false, "4×4/8-bit")).toBe("2.0× slower than 4×4/8-bit");
    expect(compareText("rate", 1, 2, false, "4×4/16-bit")).toBe("2.0× lower than 4×4/16-bit");
  });

  it("shows nothing when a value is missing", () => {
    expect(compareText("time", null, 51.14, false, "4×4/4-bit")).toBe("");
  });
});
