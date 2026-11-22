import Icon from "./Icon.jsx";
import { findPage } from "../levels.js";

// "Done here? Next: ..." link at the bottom of a level, so the path through the site is clear.
export default function NextLevel(props) {
  const next = findPage(props.to);
  return (
    <a className="next-level" href={"#/" + next.key}>
      <span className="next-level-text">
        <span className="next-level-label">{props.label || "Done here? Next:"}</span>
        <span className="next-level-name">
          <Icon name={next.icon} size={16} /> {next.name}
          <span className="bloom-tag">{next.bloom}</span>
        </span>
        <span className="next-level-goal">{next.goal}</span>
      </span>
      <span className="next-level-arrow" aria-hidden="true">
        →
      </span>
    </a>
  );
}
