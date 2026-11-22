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

// "Same answer as full precision" counts from accuracy.json's "agreement" (eval_accuracy.py):
// one entry per precision, plus the precisions whose score didn't move because as many answers
// turned right as turned wrong. Null for older files without "agreement".
export function agreementSummary(accuracy) {
  if (!accuracy || !accuracy.agreement) {
    return null;
  }
  const order = accuracy.order || ["full", "16", "8", "4", "4g"];
  let parts = [];
  let balanced = [];
  for (let i = 0; i < order.length; i++) {
    const key = order[i];
    const a = accuracy.agreement[key];
    if (!a || !accuracy[key]) {
      continue;
    }
    const label = accuracy[key].label || key;
    parts.push({ key: key, label: label, same: a.same });
    if (a.same < accuracy.n && a.lost === a.gained) {
      balanced.push(label);
    }
  }
  return { parts: parts, balanced: balanced, n: accuracy.n };
}
