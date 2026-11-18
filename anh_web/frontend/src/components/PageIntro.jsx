import Icon from "./Icon.jsx";
import { findPage } from "../levels.js";

// Heading at the top of each level: name, Bloom's levels, and what you'll do here.
export default function PageIntro(props) {
  const page = findPage(props.page);
  return (
    <div className="page-intro">
      <div className="page-intro-title">
        <Icon name={page.icon} size={20} />
        <h1>{page.name}</h1>
        <span className="bloom-tag">{page.bloom}</span>
      </div>
      <p className="page-intro-goal">{props.goal || page.goal}</p>
    </div>
  );
}
