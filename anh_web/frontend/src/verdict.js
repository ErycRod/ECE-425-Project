// Helpers for the Advanced verdict card, kept free of React so they're easy to test.

// One sentence saying what the "#x of y" ranks are out of. The count is 10 (yours + the 9
// synthesized designs), or 9 when your design IS one of the synthesized ones (it isn't
// compared with itself).
export function rankNote(ranking) {
  let total = null;
  const keys = Object.keys(ranking.ranks);
  for (let i = 0; i < keys.length; i++) {
    const r = ranking.ranks[keys[i]];
    if (r) {
      total = r.of;
      break;
    }
  }
  if (total === null) {
    return "";
  }
  if (total === 10) {
    return "Ranked against the 9 synthesized designs at the same bandwidth (10 designs in all). #1 is the best.";
  }
  return "This is one of the 9 synthesized designs, so it's ranked against the other " + (total - 1)
    + " (" + total + " in all). #1 is the best.";
}

// The Accuracy tile: the measured score and how it reads next to full precision.
// `summary` is the "accuracy" field of /api/custom_design (null until accuracy.json exists).
export function accuracyTile(summary) {
  if (!summary) {
    return { value: "n/a", detail: "not measured yet", tone: "" };
  }
  const reference = summary.full_pct === null ? "the best" : "full precision";
  let detail = "same as " + reference;
  if (summary.drop_points > 0.5) {
    detail = Math.round(summary.drop_points) + " points below " + reference;
  } else if (summary.drop_points < -0.5) {
    detail = Math.round(-summary.drop_points) + " points above " + reference;
  }
  let tone = "best";
  if (summary.warning) {
    tone = "warn";
  }
  return { value: Math.round(summary.pct) + "% right", detail: detail, tone: tone };
}
