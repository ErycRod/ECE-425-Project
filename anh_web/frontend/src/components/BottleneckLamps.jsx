import { useEffect, useRef, useState } from "react";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import InfoTip from "./InfoTip.jsx";
import { formatSeconds } from "../format.js";

const PHASES = [
  { key: "vision", name: "Vision encoder", icon: "eye" },
  { key: "prefill", name: "LM prefill", icon: "layers" },
  { key: "decode", name: "Decode (per token)", icon: "message" },
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
      <Icon name={props.icon} size={16} className="bound-icon" />
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
    lamps.push(<Lamp key={phase.key} name={phase.name} icon={phase.icon} bound={info.bound} time={info.time_s} />);
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title card-title-icon">
          <Icon name="target" size={15} />
          Bottleneck status
        </h2>
        <div className="card-actions">
          <Badge show={profilePlaceholder} title="Workload numbers are a placeholder profile" />
          <InfoTip label="About bottlenecks" align="right">
            Each phase takes whichever is slower: doing the math or moving the weights. COMPUTE means
            the multipliers are the limit, so a bigger array helps. MEMORY means bandwidth is the
            limit, so fewer bits per weight help.
          </InfoTip>
        </div>
      </div>
      <div className="bound-list">{lamps}</div>
      <div className="lamp-key">
        <span>
          <span className="bound-lamp bound-compute lamp-key-dot"></span> compute: bigger array helps
        </span>
        <span>
          <span className="bound-lamp bound-memory lamp-key-dot"></span> memory: fewer bits help
        </span>
      </div>
    </section>
  );
}
