// Helpers for showing numbers on the page.
// Missing values show "n/a". Nothing here makes up a number.

export function isMissing(value) {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return true;
  }
  return false;
}

export function formatNumber(value, decimals) {
  if (isMissing(value)) {
    return "n/a";
  }
  return value.toFixed(decimals);
}

// seconds, e.g. 83.11
export function formatSeconds(value) {
  return formatNumber(value, 2);
}

// tokens per second, e.g. 14.8
export function formatRate(value) {
  return formatNumber(value, 1);
}

// a ratio, e.g. 15.2×
export function formatRatio(value) {
  if (isMissing(value)) {
    return "n/a";
  }
  return value.toFixed(1) + "×";
}

// "Design 5 · 8×8 · 8-bit"
export function designLabel(design, P, bits) {
  return "Design " + design + " · " + P + "×" + P + " · " + bits + "-bit";
}

// short name, e.g. "4×4/16-bit"
export function shortDesignName(P, bits) {
  return P + "×" + P + "/" + bits + "-bit";
}

// one design (P, bits) from the /api/sweep data
export function findDesign(sweep, P, bits) {
  if (sweep === null || sweep === undefined) {
    return null;
  }
  for (let i = 0; i < sweep.designs.length; i++) {
    if (sweep.designs[i].P === P && sweep.designs[i].bits === bits) {
      return sweep.designs[i];
    }
  }
  return null;
}

// top / bottom, or null if a value is missing
export function ratio(top, bottom) {
  if (isMissing(top) || isMissing(bottom)) {
    return null;
  }
  if (bottom === 0) {
    return null;
  }
  return top / bottom;
}

// Compare the current design with a baseline design, e.g. "4×4/4-bit".
// kind "time": smaller is better (TTFT, answer time) -> "× faster" / "× slower"
// kind "rate": bigger is better (tokens/s)          -> "× higher" / "× lower"
export function compareText(kind, currentValue, baseValue, isBase, baseName) {
  if (isBase) {
    return "baseline (" + baseName + ")";
  }

  let howMuchBetter;
  if (kind === "time") {
    howMuchBetter = ratio(baseValue, currentValue);
  } else {
    howMuchBetter = ratio(currentValue, baseValue);
  }
  if (howMuchBetter === null) {
    return "";
  }

  // looks the same after rounding
  if (howMuchBetter.toFixed(1) === "1.0") {
    return "same as " + baseName;
  }

  let betterWord;
  let worseWord;
  if (kind === "time") {
    betterWord = "faster";
    worseWord = "slower";
  } else {
    betterWord = "higher";
    worseWord = "lower";
  }

  if (howMuchBetter > 1) {
    return formatRatio(howMuchBetter) + " " + betterWord + " than " + baseName;
  } else {
    return formatRatio(1 / howMuchBetter) + " " + worseWord + " than " + baseName;
  }
}
