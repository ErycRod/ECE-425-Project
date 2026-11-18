import { useState } from "react";
import ChartCard from "./ChartCard.jsx";
import Tooltip from "../charts/Tooltip.jsx";
import useWidth from "../charts/useWidth.js";
import { linearScale, linearTicks, tickLabel } from "../charts/scale.js";
import { formatRate } from "../format.js";
import { BIT_COLOR } from "./TradeoffChart.jsx";

const HEIGHT = 280;
const M = { left: 46, right: 22, top: 16, bottom: 44 };
const BITS = [16, 8, 4];

// First bandwidth where decode stops being memory-bound, or null.
export function kneeBandwidth(points) {
  for (let i = 0; i < points.length; i++) {
    if (points[i].decode_bound === "compute") {
      return points[i].bw_gbs;
    }
  }
  return null;
}

// SVG path through a list of [x, y] pixel pairs.
function pathFrom(pairs) {
  let text = "";
  for (let i = 0; i < pairs.length; i++) {
    text = text + (i === 0 ? "M" : "L") + pairs[i][0].toFixed(1) + "," + pairs[i][1].toFixed(1);
  }
  return text;
}

// Decode tokens/s vs memory bandwidth, one line per bit width, for the current array size.
export default function BandwidthChart(props) {
  const [boxRef, width] = useWidth(520);
  const [hoverIndex, setHoverIndex] = useState(null);
  const curve = props.curve;

  if (!curve) {
    return (
      <ChartCard icon="lineChart" title="Decode speed vs memory bandwidth">
        <p className="muted-text">Loading…</p>
      </ChartCard>
    );
  }

  const firstLine = curve.lines["16"].points;
  let yMax = 0;
  for (let b = 0; b < BITS.length; b++) {
    const points = curve.lines[String(BITS[b])].points;
    for (let i = 0; i < points.length; i++) {
      yMax = Math.max(yMax, points[i].tokens_per_s);
    }
  }

  const plotRight = width - M.right;
  const plotBottom = HEIGHT - M.bottom;
  const xAxis = linearTicks(0, firstLine[firstLine.length - 1].bw_gbs, 4);
  const yAxis = linearTicks(0, yMax, 4);
  const x = linearScale(0, xAxis.max, M.left, plotRight);
  const y = linearScale(0, yAxis.max, plotBottom, M.top);

  let grid = [];
  for (let i = 0; i < xAxis.ticks.length; i++) {
    const px = x(xAxis.ticks[i]);
    grid.push(
      <text key={"tx" + i} x={px} y={plotBottom + 16} className="axis-text" textAnchor="middle">
        {tickLabel(xAxis.ticks[i])}
      </text>
    );
  }
  for (let i = 0; i < yAxis.ticks.length; i++) {
    const py = y(yAxis.ticks[i]);
    grid.push(<line key={"gy" + i} x1={M.left} x2={plotRight} y1={py} y2={py} className="grid-line" />);
    grid.push(
      <text key={"ty" + i} x={M.left - 8} y={py + 4} className="axis-text" textAnchor="end">
        {tickLabel(yAxis.ticks[i])}
      </text>
    );
  }

  // lines: the memory-bound part solid, the compute-bound (flat) part faded
  let lines = [];
  for (let b = 0; b < BITS.length; b++) {
    const bits = BITS[b];
    const points = curve.lines[String(bits)].points;
    let memoryPart = [];
    let computePart = [];
    for (let i = 0; i < points.length; i++) {
      const pair = [x(points[i].bw_gbs), y(points[i].tokens_per_s)];
      if (points[i].decode_bound === "memory") {
        memoryPart.push(pair);
      } else {
        if (computePart.length === 0 && memoryPart.length > 0) {
          computePart.push(memoryPart[memoryPart.length - 1]); // connect the two parts
        }
        computePart.push(pair);
      }
    }
    const style = { stroke: BIT_COLOR[bits] };
    lines.push(<path key={"m" + bits} d={pathFrom(memoryPart)} className="series-line" style={style} />);
    if (computePart.length > 1) {
      lines.push(
        <path key={"c" + bits} d={pathFrom(computePart)} className="series-line series-faded" style={style} />
      );
    }
  }

  // marker for the current bandwidth on the current bits' line
  const currentLine = curve.lines[String(props.bits)].points;
  const nowX = x(props.bwGbs);
  let nowRate = null;
  if (props.estimate) {
    nowRate = props.estimate.tokens_per_s;
  }
  let nowMarker = null;
  if (nowRate !== null && props.bwGbs <= xAxis.max) {
    const py = y(nowRate);
    nowMarker = (
      <g>
        <line x1={nowX} x2={nowX} y1={M.top} y2={plotBottom} className="now-line" />
        <circle cx={nowX} cy={py} r={5} style={{ fill: BIT_COLOR[props.bits] }} className="end-dot" />
        <text x={nowX + 8} y={py - 8} className="value-label">
          {formatRate(nowRate)} tok/s
        </text>
      </g>
    );
  }

  // hover crosshair: snap to the nearest bandwidth point
  function handleMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < firstLine.length; i++) {
      if (Math.abs(x(firstLine[i].bw_gbs) - px) < Math.abs(x(firstLine[best].bw_gbs) - px)) {
        best = i;
      }
    }
    setHoverIndex(best);
  }

  let crosshair = null;
  let tip = null;
  if (hoverIndex !== null) {
    const hx = x(firstLine[hoverIndex].bw_gbs);
    crosshair = <line x1={hx} x2={hx} y1={M.top} y2={plotBottom} className="crosshair" />;
    let rows = [];
    for (let b = 0; b < BITS.length; b++) {
      const point = curve.lines[String(BITS[b])].points[hoverIndex];
      rows.push({
        color: BIT_COLOR[BITS[b]],
        value: formatRate(point.tokens_per_s),
        label: BITS[b] + "-bit · " + point.decode_bound + "-bound",
      });
    }
    tip = { x: hx, y: (M.top + plotBottom) / 2, title: firstLine[hoverIndex].bw_gbs.toFixed(2) + " GB/s", rows: rows };
  }

  // one-line takeaway from the data
  const knee = kneeBandwidth(currentLine);
  let takeaway;
  if (knee === null) {
    takeaway = (
      <>
        At {props.P}×{props.P}, {props.bits}-bit decode stays <strong>memory-bound</strong> the
        whole way: double the bandwidth, double the speed.
      </>
    );
  } else {
    takeaway = (
      <>
        At {props.P}×{props.P}, {props.bits}-bit stops improving above about{" "}
        <strong>{knee.toFixed(2)} GB/s</strong>: the array runs out of multipliers (faded part).
      </>
    );
  }

  let rows = [];
  for (let i = 0; i < firstLine.length; i = i + 3) {
    rows.push({
      cells: [
        firstLine[i].bw_gbs.toFixed(2),
        formatRate(curve.lines["16"].points[i].tokens_per_s),
        formatRate(curve.lines["8"].points[i].tokens_per_s),
        formatRate(curve.lines["4"].points[i].tokens_per_s),
      ],
    });
  }

  let legend = [];
  for (let b = 0; b < BITS.length; b++) {
    legend.push(
      <span className="legend-item" key={BITS[b]}>
        <span className="line-key" style={{ background: BIT_COLOR[BITS[b]] }}></span>
        {BITS[b]}-bit
      </span>
    );
  }
  legend.push(
    <span className="legend-item" key="faded">
      <span className="line-key line-key-faded"></span>
      compute-bound
    </span>
  );

  return (
    <ChartCard
      icon="lineChart"
      title={"Decode speed vs memory bandwidth (" + props.P + "×" + props.P + ")"}
      takeaway={takeaway}
      info={
        <>
          Each new word re-reads all {"≈"}135 M language-model weights, so decode speed = bandwidth
          ÷ (weights × bytes per weight) until the multipliers can't keep up. Fewer bits = fewer
          bytes = a steeper line. The vertical line is the bandwidth slider.
        </>
      }
      table={{ columns: ["GB/s", "16-bit tok/s", "8-bit tok/s", "4-bit tok/s"], rows: rows }}
    >
      <div className="legend">{legend}</div>
      <div className="chart-box" ref={boxRef}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Decode tokens per second against memory bandwidth"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {grid}
          <line x1={M.left} x2={plotRight} y1={plotBottom} y2={plotBottom} className="axis-line" />
          <text x={(M.left + plotRight) / 2} y={HEIGHT - 6} className="axis-title" textAnchor="middle">
            Memory bandwidth (GB/s)
          </text>
          <text transform={"translate(13," + (M.top + plotBottom) / 2 + ") rotate(-90)"} className="axis-title" textAnchor="middle">
            Words/s
          </text>
          {lines}
          {nowMarker}
          {crosshair}
        </svg>
        <Tooltip tip={tip} width={width} />
      </div>
    </ChartCard>
  );
}
