import Icon from "./Icon.jsx";
import { PAGES } from "../levels.js";

// Tabs in the top bar: Home, the three learning levels (with their Bloom's
// levels under the name) and the Code page.
export default function LevelNav(props) {
  let tabs = [];
  for (let i = 0; i < PAGES.length; i++) {
    const page = PAGES[i];
    const isOn = page.key === props.page;
    let className = "level-tab";
    if (isOn) {
      className = "level-tab level-tab-on";
    }
    tabs.push(
      <a
        key={page.key}
        className={className}
        href={"#/" + page.key}
        aria-current={isOn ? "page" : undefined}
      >
        <span className="level-tab-name">
          <Icon name={page.icon} size={14} />
          {page.name}
        </span>
        <span className="level-tab-bloom">{page.bloom}</span>
      </a>
    );
  }
  return (
    <nav className="level-nav" aria-label="Levels">
      {tabs}
    </nav>
  );
}
