import { useEffect, useRef, useState } from "react";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import InfoTip from "./InfoTip.jsx";
import { isMissing, formatNumber, compareText, findDesign, smartDecimals, humanDuration } from "../format.js";

const TWEEN_MS = 300;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Slides the shown number from the old value to the new one over 300 ms.
// The last frame is always the exact value from the backend.
function useTweenedNumber(target) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    if (isMissing(target) || isMissing(shownRef.current) || prefersReducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return;
    }

    const start = shownRef.current;
    const startTime = performance.now();
    let frameId;

    function step(now) {
      let progress = (now - startTime) / TWEEN_MS;
      if (progress >= 1) {
        shownRef.current = target;
        setShown(target);
        return;
      }
      // ease out
      const eased = 1 - (1 - progress) * (1 - progress);
      const value = start + (target - start) * eased;
      shownRef.current = value;
      setShown(value);
      frameId = requestAnimationFrame(step);
    }

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target]);

  return shown;
}

function KpiCard(props) {
  const shown = useTweenedNumber(props.value);

  // decimals follow the real value (not the sliding one), so the width doesn't jump
  let numberText = formatNumber(shown, smartDecimals(props.value));
  let numberClass = "kpi-number mono";
  if (isMissing(props.value)) {
    numberClass = "kpi-number kpi-missing mono";
  }

  let unit = null;
  if (!isMissing(props.value)) {
    unit = <span className="kpi-unit">{props.unit}</span>;
  }

  // no comparison line on the starting design itself (it would just say "baseline" 4 times)
  let compare = null;
  if (props.compare && !props.compare.startsWith("baseline")) {
    compare = <div className="kpi-compare">{props.compare}</div>;
  }

  let note = null;
  if (props.note) {
    note = <div className="kpi-note">{props.note}</div>;
  }

  return (
    <section className="card kpi-card">
      <div className="card-header">
        <h2 className="card-title card-title-icon">
          <Icon name={props.icon} size={15} />
          {props.title}
        </h2>
        <div className="card-actions">
          <Badge show={props.placeholder} title="Workload numbers are a placeholder profile" />
          <InfoTip label={"About " + props.title} align={props.alignTip}>
            {props.info}
          </InfoTip>
        </div>
      </div>
      <div className="kpi-value">
        <span className={numberClass}>{numberText}</span>
        {unit}
      </div>
      <div className="kpi-subtitle">{props.subtitle}</div>
      {compare}
      {note}
    </section>
  );
}

// The 4 headline numbers. They come straight from /api/estimate
// (perf_model.py estimate()). Every comparison is against the same starting
// design, 4x4/16-bit (design 1) at the same settings, so they're easy to read together.
export default function KpiCards(props) {
  const estimate = props.estimate;

  const base = findDesign(props.sweep, 4, 16);
  const baseName = "the 4×4/16-bit start";
  const isBase = estimate.P === 4 && estimate.bits === 16;

  let profilePlaceholder = false;
  if (estimate.flags) {
    profilePlaceholder = estimate.flags.profile_placeholder;
  }

  let baseTtft = null;
  let baseAnswer = null;
  let baseRate = null;
  let baseEnergy = null;
  if (base) {
    baseTtft = base.ttft_s;
    baseAnswer = base.answer_s;
    baseRate = base.tokens_per_s;
    if (base.energy_J !== undefined) {
      baseEnergy = base.energy_J;
    }
  }

  // energy only exists when results.json has real power
  let energy = null;
  let energyNote = null;
  if (estimate.energy_J !== undefined) {
    energy = estimate.energy_J;
  } else {
    energyNote = estimate.energy_note;
  }

  let energyCompare = null;
  if (energy !== null && baseEnergy !== null) {
    energyCompare = compareText("time", energy, baseEnergy, isBase, baseName)
      .replace("faster", "less")
      .replace("slower", "more");
  }

  return (
    <div className="kpi-row">
      <KpiCard
        title="First word"
        icon="clock"
        info="Time to first token (TTFT): vision encoder + LM prefill + one decode step. A bigger array shortens it."
        value={estimate.ttft_s}
        unit="s"
        subtitle={aboutTime(estimate.ttft_s, "until the first word appears")}
        compare={compareText("time", estimate.ttft_s, baseTtft, isBase, baseName)}
        placeholder={profilePlaceholder}
      />
      <KpiCard
        title="Writing speed"
        icon="gauge"
        info="Decode speed in tokens (about words) per second. Each word re-reads every weight from memory, so fewer bits or more bandwidth speed it up."
        value={estimate.tokens_per_s}
        unit="words/s"
        subtitle="after the first word"
        compare={compareText("rate", estimate.tokens_per_s, baseRate, isBase, baseName)}
        placeholder={profilePlaceholder}
      />
      <KpiCard
        title="Whole answer"
        icon="hourglass"
        info="First word + one decode step for each remaining word."
        alignTip="right"
        value={estimate.answer_s}
        unit="s"
        subtitle={aboutTime(estimate.answer_s, "for a " + estimate.out_tokens + "-word answer")}
        compare={compareText("time", estimate.answer_s, baseAnswer, isBase, baseName)}
        placeholder={profilePlaceholder}
      />
      <KpiCard
        title="Energy"
        icon="zap"
        info="Vivado's power estimate for this design × the whole answer time."
        alignTip="right"
        value={energy}
        unit="J"
        subtitle="per answer"
        compare={energyCompare}
        note={energyNote}
        placeholder={false}
      />
    </div>
  );
}

// "about 6 min 40 s until the first word appears" (only adds the minutes when it's over a minute)
function aboutTime(seconds, text) {
  if (isMissing(seconds) || seconds < 60) {
    return text;
  }
  return "about " + humanDuration(seconds) + " " + text;
}
