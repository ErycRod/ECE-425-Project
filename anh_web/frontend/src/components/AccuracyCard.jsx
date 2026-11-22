import ChartCard from "./ChartCard.jsx";
import Icon from "./Icon.jsx";
import { BIT_COLOR } from "./TradeoffChart.jsx";
import { formatRate, findDesign } from "../format.js";
import { agreementSummary } from "../accuracy.js";

const FULL_COLOR = "#6d7fa8";

// colour of each setting's bar (full precision is neutral, 4-bit groups share the 4-bit colour)
function colorFor(key) {
  if (key === "16" || key === "8" || key === "4") {
    return BIT_COLOR[Number(key)];
  }
  if (key === "4g") {
    return BIT_COLOR[4];
  }
  return FULL_COLOR;
}

function percent(score) {
  return Math.round(score * 1000) / 10 + "%";
}

// Answer quality at each precision, from eryc_model/accuracy.json (eval_accuracy.py),
// next to the decode speed each bit width gets on the current array size.
export default function AccuracyCard(props) {
  const acc = props.accuracy;
  let order = acc.order;
  if (!order) {
    order = ["full", "16", "8", "4", "4g"];
  }
  let keys = [];
  for (let i = 0; i < order.length; i++) {
    if (acc[order[i]] && typeof acc[order[i]].score === "number") {
      keys.push(order[i]);
    }
  }

  // decode speed per bit width at the current array size (memory-bound, so it's the bits that matter)
  function speedFor(key) {
    if (!props.sweep || !(key === "16" || key === "8" || key === "4")) {
      return null;
    }
    const d = findDesign(props.sweep, props.P, Number(key));
    if (!d) {
      return null;
    }
    return d.tokens_per_s;
  }

  let bars = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const entry = acc[key];
    const speed = speedFor(key);
    const isCurrent = key === String(props.bits);
    bars.push(
      <div className={isCurrent ? "acc-row acc-row-current" : "acc-row"} key={key}>
        <span className="acc-label">{entry.label || key}</span>
        <div className="acc-track">
          <div
            className={key === "4g" ? "acc-fill acc-fill-grouped" : "acc-fill"}
            style={{ width: Math.max(entry.score * 100, 1) + "%", background: colorFor(key) }}
          ></div>
        </div>
        <span className="acc-value mono">{percent(entry.score)}</span>
        <span className="acc-speed mono">{speed === null ? "" : formatRate(speed) + " words/s"}</span>
      </div>
    );
  }

  // one-line takeaway: 4-bit vs 16-bit speed and accuracy
  let takeaway = null;
  const s16 = speedFor("16");
  const s4 = speedFor("4");
  if (acc["16"] && acc["4"] && s16 && s4) {
    takeaway = (
      <>
        4-bit writes <strong>{(s4 / s16).toFixed(1)}× faster</strong> than 16-bit, but gets{" "}
        <strong>{percent(acc["4"].score)}</strong> of the questions right instead of {percent(acc["16"].score)}.
        {acc["4g"] ? <> Finer scales (groups of 128) bring 4-bit back to {percent(acc["4g"].score)}.</> : null}
      </>
    );
  }

  // how many answers each precision kept identical to full precision
  let agreement = null;
  const summary = agreementSummary(acc);
  if (summary && summary.parts.length > 0) {
    let counts = [];
    for (let i = 0; i < summary.parts.length; i++) {
      const part = summary.parts[i];
      counts.push(
        <span key={part.key} className="acc-agree-item">
          {part.label} <span className="mono">{part.same}/{summary.n}</span>
        </span>
      );
    }
    let balancedText = null;
    if (summary.balanced.length > 0) {
      balancedText = (
        <p className="acc-agree-note">
          {summary.balanced.join(" and ")} still change a few answers (see below), but as many turn
          right as turn wrong, so the score doesn't move.
        </p>
      );
    }
    agreement = (
      <div className="acc-agree">
        <p className="acc-agree-counts">
          <span className="dim">Same answer as full precision:</span> {counts}
        </p>
        {balancedText}
      </div>
    );
  }

  // a few questions where fewer bits changed the answer
  let examples = null;
  if (acc.examples && acc.examples.length > 0) {
    let items = [];
    const shown = acc.examples.slice(0, 3);
    for (let i = 0; i < shown.length; i++) {
      const ex = shown[i];
      let chips = [];
      for (let k = 0; k < keys.length; k++) {
        const key = keys[k];
        if (ex[key] === undefined) {
          continue;
        }
        const right = ex[key + "_correct"];
        chips.push(
          <span key={key} className={right ? "acc-chip acc-chip-right" : "acc-chip acc-chip-wrong"}>
            <span className="acc-chip-key">{acc[key].label || key}</span>
            <span className="mono">{ex[key] || "(no answer)"}</span>
          </span>
        );
      }
      items.push(
        <li key={i} className="acc-example">
          <span className="acc-question">
            “{ex.question}” <span className="dim">correct: {ex.answer}</span>
          </span>
          <span className="acc-chips">{chips}</span>
        </li>
      );
    }
    examples = (
      <div className="acc-examples">
        <h3 className="card-title card-title-icon">
          <Icon name="message" size={13} /> Where fewer bits changed the answer
        </h3>
        <ul>{items}</ul>
      </div>
    );
  }

  let tableRows = [];
  for (let i = 0; i < keys.length; i++) {
    const speed = speedFor(keys[i]);
    tableRows.push({
      current: keys[i] === String(props.bits),
      cells: [acc[keys[i]].label || keys[i], percent(acc[keys[i]].score), speed === null ? "–" : formatRate(speed)],
    });
  }

  return (
    <ChartCard
      icon="check"
      title="Accuracy vs bits"
      takeaway={takeaway}
      info={
        <>
          SmolVLM-256M answered {acc.n} VQAv2 image questions with its weights rounded to each
          precision ({acc.method}). Score: {acc.metric}. Words/s is the decode speed on a{" "}
          {props.P}×{props.P} array at the current bandwidth.
        </>
      }
      table={{ columns: ["Weights", "Right answers", "Words/s"], rows: tableRows }}
    >
      <div className="acc-bars">{bars}</div>
      <p className="acc-source">
        {acc.n} questions from {acc.dataset}
      </p>
      {agreement}
      {examples}
    </ChartCard>
  );
}
