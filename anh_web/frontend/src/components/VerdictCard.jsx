import Icon from "./Icon.jsx";
import InfoTip from "./InfoTip.jsx";
import { accuracyTile, rankNote } from "../verdict.js";

const METRICS = [
  { key: "ttft_s", name: "First word" },
  { key: "tokens_per_s", name: "Words/s" },
  { key: "energy_J", name: "Energy" },
];

const KIND_ICON = { good: "check", warning: "alert", info: "info" };

// "Evaluate": where the design ranks among all 10 (yours + 9 synthesized), how often it
// answers right, and why.
export default function VerdictCard(props) {
  const ranking = props.ranking;

  let ranks = [];
  for (let i = 0; i < METRICS.length; i++) {
    const metric = METRICS[i];
    const r = ranking.ranks[metric.key];
    let text = "n/a";
    let className = "rank-tile";
    if (r) {
      text = "#" + r.rank + " of " + r.of;
      if (r.rank === 1) {
        className = className + " rank-best";
      }
    }
    ranks.push(
      <div className={className} key={metric.key}>
        <span className="rank-name">{metric.name}</span>
        <span className="rank-value mono">{text}</span>
      </div>
    );
  }

  // accuracy isn't ranked: it only depends on the bits, so show the measured score instead
  const tile = accuracyTile(props.accuracy);
  let accuracyClass = "rank-tile";
  if (tile.tone) {
    accuracyClass = accuracyClass + " rank-" + tile.tone;
  }
  ranks.push(
    <div className={accuracyClass} key="accuracy">
      <span className="rank-name">Accuracy</span>
      <span className="rank-value mono">{tile.value}</span>
      <span className="rank-detail">{tile.detail}</span>
    </div>
  );

  let reasons = [];
  for (let i = 0; i < props.explanations.length; i++) {
    const item = props.explanations[i];
    reasons.push(
      <li key={i} className={"reason reason-" + item.kind}>
        <Icon name={KIND_ICON[item.kind] || "info"} size={14} />
        <span>{item.text}</span>
      </li>
    );
  }

  return (
    <section className="card verdict-card">
      <div className="card-header">
        <h2 className="card-title card-title-icon">
          <Icon name="target" size={15} /> Verdict <span className="bloom-tag">Evaluate</span>
        </h2>
        <InfoTip label="How the ranking works" align="right">
          Your design is compared with the 9 synthesized designs at the same bandwidth (each at its
          real Vivado clock), so there are 10 designs in all, or 9 when yours is one of the
          synthesized ones. #1 is the best. A design "beats" yours only if it is at least as good on
          first word, words/s and energy, and better on at least one. Accuracy isn't ranked: it
          depends only on the bits per weight, so the tile shows how many of the test questions
          the model answered right at that precision.
        </InfoTip>
      </div>
      <p className="rank-note">{rankNote(ranking)}</p>
      <div className="rank-row">{ranks}</div>
      <ul className="reason-list">{reasons}</ul>
    </section>
  );
}
