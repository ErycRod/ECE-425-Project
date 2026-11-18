import { useState } from "react";
import ChartCard from "./ChartCard.jsx";

const FIGURES = [
  {
    name: "architecture",
    label: "System architecture",
    caption: "Top: what runs on every slider move. Bottom: offline work saved as JSON.",
  },
  {
    name: "dataflow",
    label: "Systolic dataflow",
    caption: "A flows right, B flows down; A[i][k] and B[k][j] meet in PE(i,j) at cycle k+i+j.",
  },
];

// The hardware team's figures from docs/, served by /api/figures/<name>.
export default function FiguresCard(props) {
  const [current, setCurrent] = useState(0);
  const [broken, setBroken] = useState({});

  let available = [];
  for (let i = 0; i < FIGURES.length; i++) {
    if (!props.figures || props.figures.indexOf(FIGURES[i].name) !== -1) {
      available.push(FIGURES[i]);
    }
  }
  if (available.length === 0) {
    return null;
  }
  let index = current;
  if (index >= available.length) {
    index = 0;
  }
  const figure = available[index];

  let tabs = [];
  for (let i = 0; i < available.length; i++) {
    let className = "tab";
    if (i === index) {
      className = "tab tab-on";
    }
    tabs.push(
      <button key={available[i].name} className={className} type="button" onClick={() => setCurrent(i)}>
        {available[i].label}
      </button>
    );
  }

  let picture;
  if (broken[figure.name]) {
    picture = <p className="muted-text">Figure not found in docs/.</p>;
  } else {
    picture = (
      <img
        className="figure-img"
        src={"/api/figures/" + figure.name}
        alt={figure.label + ". " + figure.caption}
        onError={() => {
          const copy = { ...broken };
          copy[figure.name] = true;
          setBroken(copy);
        }}
      />
    );
  }

  return (
    <ChartCard icon="image" title="How it works" wide={true}>
      <div className="tabs">{tabs}</div>
      <figure className="figure">
        {picture}
        <figcaption className="figure-caption">{figure.caption}</figcaption>
      </figure>
    </ChartCard>
  );
}
