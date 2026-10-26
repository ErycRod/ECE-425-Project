import { useEffect, useRef, useState } from "react";
import Badge from "./Badge.jsx";
import { isMissing, formatNumber, compareText, findDesign1 } from "../format.js";

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

  let numberText = formatNumber(shown, props.decimals);
  let numberClass = "kpi-number mono";
  if (isMissing(props.value)) {
    numberClass = "kpi-number kpi-missing mono";
  }

  let unit = null;
  if (!isMissing(props.value)) {
    unit = <span className="kpi-unit">{props.unit}</span>;
  }

  let compare = null;
  if (props.compare) {
    compare = <div className="kpi-compare">{props.compare}</div>;
  }

  let note = null;
  if (props.note) {
    note = <div className="kpi-note">{props.note}</div>;
  }

  return (
    <section className="card kpi-card">
      <div className="card-header">
        <h2 className="card-title">{props.title}</h2>
        <Badge show={props.placeholder} title="Workload numbers are a placeholder profile" />
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
// (perf_model.py estimate()); the comparison uses design 1 from /api/sweep.
export default function KpiCards(props) {
  const estimate = props.estimate;
  const design1 = findDesign1(props.sweep);
  const isDesign1 = estimate.design === 1;

  let profilePlaceholder = false;
  if (estimate.flags) {
    profilePlaceholder = estimate.flags.profile_placeholder;
  }

  const subtitle = "est. on FPGA design " + estimate.design;

  let baseTtft = null;
  let baseRate = null;
  let baseAnswer = null;
  if (design1) {
    baseTtft = design1.ttft_s;
    baseRate = design1.tokens_per_s;
    baseAnswer = design1.answer_s;
  }

  // energy only exists when results.json has real power
  let energy = null;
  let energyNote = null;
  if (estimate.energy_J !== undefined) {
    energy = estimate.energy_J;
  } else {
    energyNote = estimate.energy_note;
  }

  return (
    <div className="kpi-row">
      <KpiCard
        title="Time to first token"
        value={estimate.ttft_s}
        decimals={2}
        unit="s"
        subtitle={subtitle}
        compare={compareText("time", estimate.ttft_s, baseTtft, isDesign1)}
        placeholder={profilePlaceholder}
      />
      <KpiCard
        title="Decode speed"
        value={estimate.tokens_per_s}
        decimals={1}
        unit="tok/s"
        subtitle={subtitle}
        compare={compareText("rate", estimate.tokens_per_s, baseRate, isDesign1)}
        placeholder={profilePlaceholder}
      />
      <KpiCard
        title="Answer time"
        value={estimate.answer_s}
        decimals={2}
        unit="s"
        subtitle={subtitle + " · " + estimate.out_tokens + " tokens"}
        compare={compareText("time", estimate.answer_s, baseAnswer, isDesign1)}
        placeholder={profilePlaceholder}
      />
      <KpiCard
        title="Energy per answer"
        value={energy}
        decimals={2}
        unit="J"
        subtitle={subtitle}
        note={energyNote}
        placeholder={false}
      />
    </div>
  );
}
