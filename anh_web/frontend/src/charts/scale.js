// Small helpers for drawing charts with plain SVG (no chart library).
// A "scale" turns a data value into a pixel position.

// Linear scale: value in [d0, d1] -> pixel in [r0, r1].
export function linearScale(d0, d1, r0, r1) {
  return function (value) {
    if (d1 === d0) {
      return (r0 + r1) / 2;
    }
    return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
  };
}

// Log scale (base 10): value in [d0, d1] -> pixel in [r0, r1]. Values must be > 0.
export function logScale(d0, d1, r0, r1) {
  const l0 = Math.log10(d0);
  const l1 = Math.log10(d1);
  return function (value) {
    if (l1 === l0) {
      return (r0 + r1) / 2;
    }
    return r0 + ((Math.log10(value) - l0) / (l1 - l0)) * (r1 - r0);
  };
}

// A "nice" step for about `count` ticks between lo and hi: 1, 2 or 5 times a power of 10.
export function niceStep(lo, hi, count) {
  const raw = (hi - lo) / Math.max(count, 1);
  if (raw <= 0) {
    return 1;
  }
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / power;
  let nice = 10;
  if (fraction <= 1) {
    nice = 1;
  } else if (fraction <= 2) {
    nice = 2;
  } else if (fraction <= 5) {
    nice = 5;
  }
  return nice * power;
}

// Ticks for a linear axis that starts at 0 (or lo) and covers hi.
// Returns { ticks, max } where max is the top of the axis (a whole step).
export function linearTicks(lo, hi, count) {
  const step = niceStep(lo, hi, count);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let value = start; value <= end + step / 1000; value = value + step) {
    // round away float noise like 0.30000000000000004
    ticks.push(Math.round(value * 1e9) / 1e9);
  }
  return { ticks: ticks, min: start, max: end };
}

// Ticks for a log axis: 1, 2, 5 x 10^k inside [lo, hi].
export function logTicks(lo, hi) {
  const ticks = [];
  const first = Math.floor(Math.log10(lo));
  const last = Math.ceil(Math.log10(hi));
  for (let k = first; k <= last; k++) {
    const base = Math.pow(10, k);
    const multipliers = [1, 2, 5];
    for (let i = 0; i < multipliers.length; i++) {
      const value = Math.round(multipliers[i] * base * 1e9) / 1e9;
      if (value >= lo && value <= hi) {
        ticks.push(value);
      }
    }
  }
  return ticks;
}

// Pad a log domain so points don't sit on the edge: [lo / f, hi * f].
export function padLogDomain(lo, hi, factor) {
  return [lo / factor, hi * factor];
}

// Short axis label: 1000 -> "1,000", 0.5 -> "0.5", 12000 -> "12K".
export function tickLabel(value) {
  if (Math.abs(value) >= 10000) {
    return Math.round(value / 1000) + "K";
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }
  return String(Math.round(value * 100) / 100);
}

// Smallest and largest of a list of numbers (ignores null / NaN).
export function extent(values) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v === "number" && !Number.isNaN(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (lo === Infinity) {
    return null;
  }
  return [lo, hi];
}

// Percent of a chip limit, or null if a value is missing.
export function percentOf(used, limit) {
  if (typeof used !== "number" || typeof limit !== "number" || limit <= 0) {
    return null;
  }
  return (used / limit) * 100;
}
