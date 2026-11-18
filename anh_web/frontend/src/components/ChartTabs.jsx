import { useState } from "react";
import Icon from "./Icon.jsx";

// Shows one chart at a time, with a row of tabs to switch.
// tabs: [{ key, label, icon, content }]
export default function ChartTabs(props) {
  const [current, setCurrent] = useState(props.tabs[0].key);

  let buttons = [];
  let content = null;
  for (let i = 0; i < props.tabs.length; i++) {
    const tab = props.tabs[i];
    const isOn = tab.key === current;
    if (isOn) {
      content = tab.content;
    }
    buttons.push(
      <button
        key={tab.key}
        type="button"
        role="tab"
        aria-selected={isOn}
        className={isOn ? "chart-tab chart-tab-on" : "chart-tab"}
        onClick={() => setCurrent(tab.key)}
      >
        <Icon name={tab.icon} size={14} />
        {tab.label}
      </button>
    );
  }

  return (
    <div className="chart-tabs">
      <div className="chart-tab-row" role="tablist" aria-label="Charts">
        {buttons}
      </div>
      {content}
    </div>
  );
}
