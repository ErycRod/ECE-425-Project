import { describe, it, expect } from "vitest";
import {
  formatSeconds,
  formatRate,
  formatRatio,
  designLabel,
  findDesign1,
  ratio,
  compareText,
} from "./format.js";

// numbers below are from perf/perf_model.py's table (100 MHz, 1 GB/s, placeholder profile)

describe("formatting", () => {
  it("rounds seconds to 2 decimals", () => {
    expect(formatSeconds(83.1149)).toBe("83.11");
    expect(formatSeconds(5.45)).toBe("5.45");
  });

  it("rounds tokens/s to 1 decimal", () => {
    expect(formatRate(14.8148)).toBe("14.8");
    expect(formatRate(9.4697)).toBe("9.5");
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

describe("comparison with design 1", () => {
  it("finds design 1 in sweep data", () => {
    const sweep = { designs: [{ design: 2, P: 8 }, { design: 1, P: 4 }] };
    expect(findDesign1(sweep).P).toBe(4);
    expect(findDesign1(null)).toBe(null);
  });

  it("ratio gives null when a value is missing or zero", () => {
    expect(ratio(10, 2)).toBe(5);
    expect(ratio(null, 2)).toBe(null);
    expect(ratio(10, 0)).toBe(null);
  });

  it("16x16 TTFT is 15.2x faster than 4x4 (83.11 s vs 5.45 s)", () => {
    expect(compareText("time", 5.45, 83.11, false)).toBe("15.2× faster than 4×4/16-bit");
  });

  it("tokens/s: higher, same and baseline", () => {
    expect(compareText("rate", 14.8, 3.7, false)).toBe("4.0× higher than 4×4/16-bit");
    expect(compareText("rate", 3.7, 3.7, false)).toBe("same as 4×4/16-bit");
    expect(compareText("rate", 3.7, 3.7, true)).toBe("baseline (4×4/16-bit)");
  });

  it("says slower or lower when worse", () => {
    expect(compareText("time", 20, 10, false)).toBe("2.0× slower than 4×4/16-bit");
    expect(compareText("rate", 1, 2, false)).toBe("2.0× lower than 4×4/16-bit");
  });

  it("shows nothing when a value is missing", () => {
    expect(compareText("time", null, 83.11, false)).toBe("");
  });
});
