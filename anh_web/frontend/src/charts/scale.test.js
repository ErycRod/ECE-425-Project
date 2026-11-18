import { describe, it, expect } from "vitest";
import {
  linearScale,
  logScale,
  niceStep,
  linearTicks,
  logTicks,
  tickLabel,
  extent,
  percentOf,
} from "./scale.js";

describe("scales", () => {
  it("linear scale maps ends and middle", () => {
    const x = linearScale(0, 10, 100, 200);
    expect(x(0)).toBe(100);
    expect(x(10)).toBe(200);
    expect(x(5)).toBe(150);
  });

  it("log scale puts 10 halfway between 1 and 100", () => {
    const x = logScale(1, 100, 0, 200);
    expect(x(1)).toBe(0);
    expect(x(100)).toBe(200);
    expect(x(10)).toBeCloseTo(100);
  });

  it("does not divide by zero on a flat domain", () => {
    expect(linearScale(5, 5, 0, 100)(5)).toBe(50);
    expect(logScale(5, 5, 0, 100)(5)).toBe(50);
  });
});

describe("ticks", () => {
  it("nice steps are 1, 2 or 5 times a power of ten", () => {
    expect(niceStep(0, 60, 5)).toBe(20);
    expect(niceStep(0, 4, 4)).toBe(1);
    expect(niceStep(0, 0.9, 4)).toBeCloseTo(0.5);
  });

  it("linear ticks cover the data", () => {
    const axis = linearTicks(0, 59.4, 5);
    expect(axis.min).toBe(0);
    expect(axis.max).toBeGreaterThanOrEqual(59.4);
    expect(axis.ticks[0]).toBe(0);
  });

  it("log ticks are 1-2-5 values inside the range", () => {
    expect(logTicks(30, 1100)).toEqual([50, 100, 200, 500, 1000]);
  });

  it("tick labels", () => {
    expect(tickLabel(1000)).toBe("1,000");
    expect(tickLabel(53200)).toBe("53K");
    expect(tickLabel(0.25)).toBe("0.25");
  });
});

describe("helpers", () => {
  it("extent skips missing values", () => {
    expect(extent([3, null, 1, NaN, 7])).toEqual([1, 7]);
    expect(extent([null])).toBe(null);
  });

  it("percent of a chip limit", () => {
    expect(percentOf(220, 220)).toBe(100);
    expect(percentOf(null, 220)).toBe(null);
  });
});
