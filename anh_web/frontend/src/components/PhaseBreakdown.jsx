import { useState } from "react";
import ChartCard from "./ChartCard.jsx";
import Tooltip from "../charts/Tooltip.jsx";
import useWidth from "../charts/useWidth.js";
import { linearScale, linearTicks, tickLabel } from "../charts/scale.js";
import { formatSeconds, shortDesignName } from "../format.js";

// phase colours (checked for colour-blind contrast on the dark card)
export const PHASE_COLOR = { vision: "#c98500", prefill: "#d55181", decode: "#9085e9" };

const ROW_H = 28;
const BAR_H = 16;
const LABEL_W = 96;
const TOTAL_W = 64;
const TOP = 6;
const AXIS_H = 42;

// rectangle with only the right end rounded (the "data end"); square at the baseline
function rightRounded(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  return (
    "M" + x + "," + y +
    "H" + (x + w - rr) +
    "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + rr) +
    "V" + (y + h - rr) +
    "Q" + (x + w) + "," + (y + h) + " " + (x + w - rr) + "," + (y + h) +
    "H" + x + "Z"
  );
}

// The three parts of one answer for a design: vision, prefill, all decode steps.
export function answerParts(design) {
  const decodeAll = design.phases.decode.time_s * design.out_tokens;
  return [
    { key: "vision", name: "Vision encoder", time: design.phases.vision.time_s, bound: design.phases.vision.bound },
    { key: "prefill", name: "LM prefill", time: design.phases.prefill.time_s, bound: design.phases.prefill.bound },
    { key: "decode", name: "Decode × " + design.out_tokens, time: decodeAll, bound: design.phases.decode.bound },
  ];
}

// Stacked bars: where the answer time goes, for all 9 designs.
export default function PhaseBreakdown(props) {
  const [boxRef, width] = useWidth(520);
  const [tip, setTip] = useState(null);
  const designs = props.sweep.designs;
  const estimate = props.estimate;

  let maxTotal = 0;
  for (let i = 0; i < designs.length; i++) {
    maxTotal = Math.max(maxTotal, designs[i].answer_s);
  }
  const axis = linearTicks(0, maxTotal, 4);
  const barLeft = LABEL_W;
  const barRight = width - TOTAL_W;
  const x = linearScale(0, axis.max, barLeft, barRight);
  const height = TOP + designs.length * ROW_H + AXIS_H;
  const plotBottom = TOP + designs.length * ROW_H;

  let gridLines = [];
  for (let i = 0; i < axis.ticks.length; i++) {
    const px = x(axis.ticks[i]);
    gridLines.push(<line key={"g" + i} x1={px} x2={px} y1={TOP} y2={plotBottom} className="grid-line" />);
    gridLines.push(
      <text key={"t" + i} x={px} y={plotBottom + 16} className="axis-text" textAnchor="middle">
        {tickLabel(axis.ticks[i])}
      </text>
    );
  }

  let rows = [];
  for (let r = 0; r < designs.length; r++) {
    const d = designs[r];
    const isCurrent = d.P === props.P && d.bits === props.bits;
    const rowTop = TOP + r * ROW_H;
    const barTop = rowTop + (ROW_H - BAR_H) / 2;
    const parts = answerParts(d);

    let segments = [];
    let start = 0;
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p];
      const x0 = x(start);
      const x1 = x(start + part.time);
      start = start + part.time;
      // 2 px gap before every segment except the first
      let left = x0;
      if (p > 0) {
        left = x0 + 2;
      }
      const w = x1 - left;
      if (w <= 0.5) {
        continue;
      }
      const isLast = p === parts.length - 1;
      let shape;
      if (isLast) {
        shape = <path d={rightRounded(left, barTop, w, BAR_H, 4)} />;
      } else {
        shape = <rect x={left} y={barTop} width={w} height={BAR_H} />;
      }
      const percent = (part.time / d.answer_s) * 100;
      segments.push(
        <g
          key={part.key}
          className="segment"
          style={{ fill: PHASE_COLOR[part.key] }}
          onMouseEnter={() =>
            setTip({
              x: left + w / 2,
              y: rowTop,
              title: "Design " + d.design + " · " + shortDesignName(d.P, d.bits),
              rows: [
                { color: PHASE_COLOR[part.key], value: formatSeconds(part.time) + " s", label: part.name },
                { value: percent.toFixed(0) + "%", label: "of the answer time" },
                { value: part.bound, label: "bound" },
              ],
            })
          }
          onMouseLeave={() => setTip(null)}
        >
          {shape}
        </g>
      );
    }

    let rowClass = "bar-row";
    if (isCurrent) {
      rowClass = "bar-row bar-row-current";
    }

    rows.push(
      <g key={d.design} className={rowClass} onClick={() => props.onSelect(d.P, d.bits)}>
        <rect x={0} y={rowTop} width={width} height={ROW_H} className="row-band" rx={6} />
        <text x={8} y={rowTop + ROW_H / 2 + 4} className="row-label">
          {d.P}×{d.P} · {d.bits}b
        </text>
        {segments}
        <text x={x(d.answer_s) + 6} y={rowTop + ROW_H / 2 + 4} className="row-total">
          {d.answer_s >= 100 ? d.answer_s.toFixed(0) : d.answer_s.toFixed(1)} s
        </text>
      </g>
    );
  }

  // takeaway: share of the vision encoder in the time to first token, for the current design
  let takeaway = null;
  if (estimate) {
    const share = (estimate.phases.vision.time_s / estimate.ttft_s) * 100;
    takeaway = (
      <>
        On this design the <strong>vision encoder is {share.toFixed(0)}%</strong> of the wait for the
        first word. Shrinking it is where a bigger array pays off.
      </>
    );
  }

  let tableRows = [];
  for (let i = 0; i < designs.length; i++) {
    const d = designs[i];
    const parts = answerParts(d);
    tableRows.push({
      current: d.P === props.P && d.bits === props.bits,
      cells: [
        shortDesignName(d.P, d.bits),
        formatSeconds(parts[0].time),
        formatSeconds(parts[1].time),
        formatSeconds(parts[2].time),
        formatSeconds(d.answer_s),
      ],
    });
  }

  let outTokens = 32;
  if (designs.length > 0) {
    outTokens = designs[0].out_tokens;
  }
  const legendItems = [
    { key: "vision", name: "Vision encoder" },
    { key: "prefill", name: "LM prefill" },
    { key: "decode", name: "Decode (" + outTokens + " words)" },
  ];
  let legend = [];
  for (let i = 0; i < legendItems.length; i++) {
    legend.push(
      <span className="legend-item" key={legendItems[i].key}>
        <span className="swatch" style={{ background: PHASE_COLOR[legendItems[i].key] }}></span>
        {legendItems[i].name}
      </span>
    );
  }

  return (
    <ChartCard
      icon="barChart"
      title="Where the answer time goes"
      takeaway={takeaway}
      info={
        <>
          Answer time = vision encoder + LM prefill + one decode step per output word. Vision and
          prefill are big matrix multiplies (compute-bound); decode re-reads the weights for every
          word (memory-bound). Click a row to select that design.
        </>
      }
      table={{ columns: ["Design", "Vision (s)", "Prefill (s)", "Decode (s)", "Total (s)"], rows: tableRows }}
    >
      <div className="legend">{legend}</div>
      <div className="chart-box" ref={boxRef}>
        <svg width={width} height={height} role="img" aria-label="Answer time split by phase for each design">
          {gridLines}
          {rows}
          <text x={(barLeft + barRight) / 2} y={height - 4} className="axis-title" textAnchor="middle">
            Seconds per answer
          </text>
        </svg>
        <Tooltip tip={tip} width={width} />
      </div>
    </ChartCard>
  );
}
