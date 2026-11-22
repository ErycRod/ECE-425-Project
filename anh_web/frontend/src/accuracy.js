// Helpers for the accuracy results (eryc_model/accuracy.json), kept free of React so they're easy to test.

// The accuracy task: the fastest bit width (fewest bits, since decode is memory-bound) whose
// accuracy is within 5 points of full precision. Needs eryc_model/accuracy.json.
export function bestBitsWithinFivePoints(accuracy) {
  if (!accuracy || !accuracy.full) {
    return null;
  }
  const options = [4, 8, 16];
  for (let i = 0; i < options.length; i++) {
    const entry = accuracy[String(options[i])];
    if (entry && accuracy.full.score - entry.score <= 0.05) {
      return options[i];
    }
  }
  return null;
}
