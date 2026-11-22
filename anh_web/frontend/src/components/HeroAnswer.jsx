import Icon from "./Icon.jsx";
import InfoTip from "./InfoTip.jsx";
import { designLabel, humanDuration, formatRate, ratio, findDesign } from "../format.js";

const PHASE_NAMES = { vision: "vision encoder", prefill: "LM prefill", decode: "first decode step" };

// The current design's result in one or two plain sentences, before any chart.
export default function HeroAnswer(props) {
  const e = props.estimate;

  // which phase is most of the wait for the first word
  const parts = ["vision", "prefill", "decode"];
  let biggest = "vision";
  for (let i = 0; i < parts.length; i++) {
    if (e.phases[parts[i]].time_s > e.phases[biggest].time_s) {
      biggest = parts[i];
    }
  }
  const share = (e.phases[biggest].time_s / e.ttft_s) * 100;
  const bound = e.phases[biggest].bound;
  let advice = "fewer bits or more bandwidth help most";
  if (bound === "compute") {
    advice = "a bigger array helps most";
  }

  // compared with the starting design (4x4, 16-bit) at the same settings
  let compare = null;
  const start = findDesign(props.sweep, 4, 16);
  if (start && !(e.P === 4 && e.bits === 16)) {
    const speedup = ratio(start.answer_s, e.answer_s);
    if (speedup !== null) {
      let text;
      if (speedup >= 1.05) {
        text = speedup.toFixed(1) + "× faster than the starting design (4×4, 16-bit).";
      } else if (speedup <= 0.95) {
        text = (1 / speedup).toFixed(1) + "× slower than the starting design (4×4, 16-bit).";
      } else {
        text = "About the same as the starting design (4×4, 16-bit).";
      }
      compare = <p className="hero-compare">{text}</p>;
    }
  } else if (start) {
    compare = <p className="hero-compare">This is the starting design. Try changing the array size or bits.</p>;
  }

  let label = designLabel(e.design, e.P, e.bits);
  let estimatedTag = null;
  if (e.custom) {
    label = "Your design · " + e.P + "×" + e.P + " · " + e.bits + "-bit";
    if (e.design) {
      label = label + " (= design " + e.design + ")";
    }
    if (e.resources && e.resources.estimated) {
      estimatedTag = <span className="estimated-tag">Estimated hardware</span>;
    }
  }

  // answer quality at this design's bit width (from eryc_model/accuracy.json)
  let quality = null;
  if (props.accuracy && props.accuracy[String(e.bits)]) {
    const right = Math.round(props.accuracy[String(e.bits)].score * 100);
    let reference = "";
    if (props.accuracy.full) {
      reference = " (" + Math.round(props.accuracy.full.score * 100) + "% with full-precision weights)";
    }
    quality = (
      <p className="hero-quality">
        <Icon name="check" size={15} /> With {e.bits}-bit weights it answers <strong>{right}%</strong> of our{" "}
        {props.accuracy.n} test questions right{reference}.
      </p>
    );
  }

  return (
    <section className="card hero-answer">
      <div className="hero-top">
        <span className="hero-labels">
          <span className="design-pill mono">{label}</span>
          {estimatedTag}
        </span>
        <InfoTip label="How these numbers are made" align="right">
          Predicted with the hardware team's roofline model at {Number(e.f_mhz).toFixed(1)} MHz ({e.f_mhz_source}),{" "}
          {e.bw_gbs.toFixed(2)} GB/s and {Math.round(e.util * 100)}% utilization, using the
          measured SmolVLM workload. They are estimates, not times measured on a board.
        </InfoTip>
      </div>
      <p className="hero-main">
        A question about an image takes <strong>{humanDuration(e.answer_s)}</strong> to answer.
      </p>
      <p className="hero-sub">
        <Icon name="clock" size={15} /> First word after <strong>{humanDuration(e.ttft_s)}</strong>
        <span className="hero-dot">·</span>
        <Icon name="gauge" size={15} /> then <strong>{formatRate(e.tokens_per_s)} words/s</strong>
      </p>
      {quality}
      <p className="hero-why">
        {share.toFixed(0)}% of the wait is the <strong>{PHASE_NAMES[biggest]}</strong>, which is{" "}
        {bound === "compute" ? "math-limited" : "memory-limited"}, so {advice}.
      </p>
      {compare}
    </section>
  );
}
