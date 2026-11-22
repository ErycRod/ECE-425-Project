import { useState } from "react";
import ChartCard from "./ChartCard.jsx";
import Tooltip from "../charts/Tooltip.jsx";
import useWidth from "../charts/useWidth.js";
import { logScale, logTicks, padLogDomain, tickLabel, extent } from "../charts/scale.js";
import { formatSeconds, formatRate, shortDesignName } from "../format.js";

export const BIT_COLOR = { 16: "var(--bits-16)", 8: "var(--bits-8)", 4: "var(--bits-4)" };
const BIT_NAME = { 16: "16-bit (DSP blocks)", 8: "8-bit (LUTs)", 4: "4-bit (LUTs)" };
const HEIGHT = 300;
const M = { left: 54, right: 22, top: 18, bottom: 46 };

// Marker shape per bit width, so the bits can be told apart without colour.
export function BitMarker(props) {
  const style = { fill: BIT_COLOR[props.bits], stroke: "var(--card)", strokeWidth: 2 };
  const r = props.r || 5.5;
  if (props.bits === 8) {
    return <rect x={props.x - r} y={props.y - r} width={r * 2} height={r * 2} rx={1.5} style={style} />;
  }
  if (props.bits === 4) {
    const h = r * 1.25;
    const points =
      props.x + "," + (props.y - h) + " " + (props.x + h) + "," + (props.y + h * 0.8) + " " +
      (props.x - h) + "," + (props.y + h * 0.8);
    return <polygon points={points} style={style} strokeLinejoin="round" />;
  }
  return <circle cx={props.x} cy={props.y} r={r} style={style} />;
}

export function BitLegend() {
  const bitsList = [16, 8, 4];
  let items = [];
  for (let i = 0; i < bitsList.length; i++) {
    const bits = bitsList[i];
    items.push(
      <span className="legend-item" key={bits}>
        <svg width="14" height="14" aria-hidden="true">
          <BitMarker bits={bits} x={7} y={7} r={4.5} />
        </svg>
        {BIT_NAME[bits]}
      </span>
    );
  }
  return <div className="legend">{items}</div>;
}

// Scatter of all 9 designs: time to first token (x) vs decode speed (y).
// Click a point to switch the whole page to that design.
export default function TradeoffChart(props) {
  const [boxRef, width] = useWidth(520);
  const [tip, setTip] = useState(null);
  const designs = props.sweep.designs;

  // the user's own design (Advanced level), drawn as a star and kept inside the axes
  const extra = props.extra || null;
  let ttftValues = designs.map((d) => d.ttft_s);
  let rateValues = designs.map((d) => d.tokens_per_s);
  if (extra) {
    ttftValues = ttftValues.concat([extra.ttft_s]);
    rateValues = rateValues.concat([extra.tokens_per_s]);
  }
  const ttftRange = extent(ttftValues);
  const rateRange = extent(rateValues);
  const xDomain = padLogDomain(ttftRange[0], ttftRange[1], 1.3);
  const yDomain = padLogDomain(rateRange[0], rateRange[1], 1.45);

  const plotRight = width - M.right;
  const plotBottom = HEIGHT - M.bottom;
  const x = logScale(xDomain[0], xDomain[1], M.left, plotRight);
  const y = logScale(yDomain[0], yDomain[1], plotBottom, M.top);

  // axes and gridlines
  let grid = [];
  const xTicks = logTicks(xDomain[0], xDomain[1]);
  for (let i = 0; i < xTicks.length; i++) {
    const px = x(xTicks[i]);
    grid.push(<line key={"gx" + i} x1={px} x2={px} y1={M.top} y2={plotBottom} className="grid-line" />);
    grid.push(
      <text key={"tx" + i} x={px} y={plotBottom + 16} className="axis-text" textAnchor="middle">
        {tickLabel(xTicks[i])}
      </text>
    );
  }
  const yTicks = logTicks(yDomain[0], yDomain[1]);
  for (let i = 0; i < yTicks.length; i++) {
    const py = y(yTicks[i]);
    grid.push(<line key={"gy" + i} x1={M.left} x2={plotRight} y1={py} y2={py} className="grid-line" />);
    grid.push(
      <text key={"ty" + i} x={M.left - 8} y={py + 4} className="axis-text" textAnchor="end">
        {tickLabel(yTicks[i])}
      </text>
    );
  }

  function showTip(d) {
    setTip({
      x: x(d.ttft_s),
      y: y(d.tokens_per_s),
      title: "Design " + d.design + " · " + shortDesignName(d.P, d.bits),
      rows: [
        { label: "time to first token", value: formatSeconds(d.ttft_s) + " s" },
        { label: "decode speed", value: formatRate(d.tokens_per_s) + " tok/s" },
        { label: "clock", value: d.f_mhz + " MHz" },
      ],
    });
  }

  // when the user's design sits on top of the selected synthesized point (same design, same
  // clock), one label "You (8×8)" replaces the two overlapping ones
  function starCovers(px, py) {
    return extra !== null && Math.abs(x(extra.ttft_s) - px) < 20 && Math.abs(y(extra.tokens_per_s) - py) < 20;
  }
  let starOnPoint = false;

  // points: the current design last so it draws on top
  let points = [];
  let currentPoint = null;
  for (let i = 0; i < designs.length; i++) {
    const d = designs[i];
    const px = x(d.ttft_s);
    const py = y(d.tokens_per_s);
    const isCurrent = d.P === props.P && d.bits === props.bits;

    let labelClass = "point-label";
    if (isCurrent) {
      labelClass = "point-label point-label-current";
    }

    // label above the point; move it below if a point in the same row is too close
    let labelY = py - (isCurrent ? 19 : 12);
    for (let j = 0; j < designs.length; j++) {
      const other = designs[j];
      const close = Math.abs(x(other.ttft_s) - px) < 40 && Math.abs(y(other.tokens_per_s) - py) < 14;
      if (j !== i && close && other.P > d.P) {
        labelY = py + (isCurrent ? 27 : 20);
      }
    }

    const point = (
      <g
        key={d.design}
        className="point"
        tabIndex={0}
        role="button"
        aria-label={"Design " + d.design + ", " + shortDesignName(d.P, d.bits) + ", TTFT " +
          formatSeconds(d.ttft_s) + " seconds, " + formatRate(d.tokens_per_s) + " tokens per second"}
        onMouseEnter={() => showTip(d)}
        onMouseLeave={() => setTip(null)}
        onFocus={() => showTip(d)}
        onBlur={() => setTip(null)}
        onClick={() => props.onSelect(d.P, d.bits)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            props.onSelect(d.P, d.bits);
          }
        }}
      >
        {isCurrent ? <circle cx={px} cy={py} r={13} className="current-ring" /> : null}
        <BitMarker bits={d.bits} x={px} y={py} r={isCurrent ? 7 : 5.5} />
        {isCurrent && starCovers(px, py) ? null : (
          <text x={px} y={labelY} className={labelClass} textAnchor="middle">
            {d.P}×{d.P}
          </text>
        )}
        <circle cx={px} cy={py} r={16} className="hit-area" />
      </g>
    );
    if (isCurrent) {
      starOnPoint = starCovers(px, py);
      currentPoint = point;
    } else {
      points.push(point);
    }
  }

  let extraStar = null;
  if (extra) {
    const ex = x(extra.ttft_s);
    const ey = y(extra.tokens_per_s);
    extraStar = (
      <ExtraStar
        x={ex}
        y={ey}
        label={starOnPoint ? "You (" + props.P + "×" + props.P + ")" : "You"}
        onHover={(on) => {
          if (on) {
            setTip({
              x: ex,
              y: ey,
              title: extra.label,
              rows: [
                { label: "time to first token", value: formatSeconds(extra.ttft_s) + " s" },
                { label: "decode speed", value: formatRate(extra.tokens_per_s) + " tok/s" },
              ],
            });
          } else {
            setTip(null);
          }
        }}
      />
    );
  }

  // table view (same numbers)
  let rows = [];
  for (let i = 0; i < designs.length; i++) {
    const d = designs[i];
    rows.push({
      current: d.P === props.P && d.bits === props.bits,
      cells: [d.design, shortDesignName(d.P, d.bits), d.f_mhz, formatSeconds(d.ttft_s), formatRate(d.tokens_per_s)],
    });
  }

  return (
    <ChartCard
      icon="scatter"
      title="Tradeoff: first token vs decode speed"
      takeaway={
        <>
          Up = talks faster (set by <strong>bits</strong>). Left = first word sooner (set by{" "}
          <strong>array size</strong>). Click a point to try it.
        </>
      }
      info={
        <>
          Each point is one of the 9 synthesized designs at the current bandwidth. Both axes are
          log scale. Points with the same bits line up in a row: decode reads every weight once
          per word, so only bytes per weight and bandwidth move it.
        </>
      }
      table={{ columns: ["Design", "Array/bits", "MHz", "TTFT (s)", "tok/s"], rows: rows }}
    >
      <BitLegend />
      <div className="chart-box" ref={boxRef}>
        <svg width={width} height={HEIGHT} role="img" aria-label="Scatter of the 9 designs">
          {grid}
          <line x1={M.left} x2={plotRight} y1={plotBottom} y2={plotBottom} className="axis-line" />
          <text x={(M.left + plotRight) / 2} y={HEIGHT - 6} className="axis-title" textAnchor="middle">
            First word (s, log scale) — left is sooner
          </text>
          <text
            transform={"translate(14," + (M.top + plotBottom) / 2 + ") rotate(-90)"}
            className="axis-title"
            textAnchor="middle"
          >
            Words/s (log)
          </text>
          {points}
          {currentPoint}
          {extraStar}
        </svg>
        <Tooltip tip={tip} width={width} />
      </div>
    </ChartCard>
  );
}

// five-point star for the user's own design (Advanced level)
function ExtraStar(props) {
  let points = [];
  for (let i = 0; i < 10; i++) {
    let r = 4.6;
    if (i % 2 === 0) {
      r = 11;
    }
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push((props.x + r * Math.cos(angle)).toFixed(1) + "," + (props.y + r * Math.sin(angle)).toFixed(1));
  }
  return (
    <g
      className="extra-star"
      tabIndex={0}
      aria-label="Your design"
      onMouseEnter={() => props.onHover(true)}
      onMouseLeave={() => props.onHover(false)}
      onFocus={() => props.onHover(true)}
      onBlur={() => props.onHover(false)}
    >
      <polygon points={points.join(" ")} />
      <text x={props.x} y={props.y - 16} textAnchor="middle" className="point-label point-label-current">
        {props.label}
      </text>
      <circle cx={props.x} cy={props.y} r={16} className="hit-area" />
    </g>
  );
}
