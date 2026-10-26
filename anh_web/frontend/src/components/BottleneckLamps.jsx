import { useEffect, useRef, useState } from "react";
import Badge from "./Badge.jsx";
import { formatSeconds } from "../format.js";

const PHASES = [
  { key: "vision", name: "Vision encoder" },
  { key: "prefill", name: "LM prefill" },
  { key: "decode", name: "Decode (per token)" },
];

// One indicator lamp. It pulses for a moment when its bound flips.
function Lamp(props) {
  const lastBound = useRef(props.bound);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (lastBound.current === props.bound) {
      return;
    }
    lastBound.current = props.bound;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(timer);
  }, [props.bound]);

  let lampClass = "bound-lamp bound-" + props.bound;
  if (flash) {
    lampClass = lampClass + " bound-flash";
  }

  return (
    <div className="bound-item">
      <span className={lampClass}></span>
      <div className="bound-text">
        <span className="bound-name">{props.name}</span>
        <span className={"bound-label mono bound-label-" + props.bound}>
          {props.bound.toUpperCase()}
        </span>
      </div>
      <span className="bound-time mono">{formatSeconds(props.time)} s</span>
    </div>
  );
}

// Which side limits each phase, from perf_model.py phase_time().
export default function BottleneckLamps(props) {
  const estimate = props.estimate;

  let profilePlaceholder = false;
  if (estimate.flags) {
    profilePlaceholder = estimate.flags.profile_placeholder;
  }

  let lamps = [];
  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i];
    const info = estimate.phases[phase.key];
    lamps.push(<Lamp key={phase.key} name={phase.name} bound={info.bound} time={info.time_s} />);
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Bottleneck status</h2>
        <Badge show={profilePlaceholder} title="Workload numbers are a placeholder profile" />
      </div>
      <div className="bound-list">{lamps}</div>
      <p className="card-footnote">
        COMPUTE: limited by the multipliers, so a bigger array helps. MEMORY: limited by
        bandwidth, so fewer bits help.
      </p>
    </section>
  );
}
