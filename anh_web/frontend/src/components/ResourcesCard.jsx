import ChartCard from "./ChartCard.jsx";
import Icon from "./Icon.jsx";
import { percentOf } from "../charts/scale.js";
import { shortDesignName, formatNumber } from "../format.js";

const RESOURCES = [
  { key: "luts", name: "LUTs", about: "logic cells (8/4-bit multipliers are built from these)" },
  { key: "dsps", name: "DSPs", about: "hard multiplier blocks (16-bit multipliers use these)" },
  { key: "ffs", name: "Flip-flops", about: "registers between PEs" },
  { key: "bram", name: "BRAM", about: "on-chip memory tiles" },
];

function count(value) {
  if (value === null || value === undefined) {
    return "n/a";
  }
  return Math.round(value).toLocaleString("en-US");
}

// One horizontal meter: used / chip limit. The fill colour shows how close to full it is.
function Meter(props) {
  const percent = percentOf(props.used, props.limit);

  let level = "ok";
  if (percent !== null && percent >= 100) {
    level = "full";
  } else if (percent !== null && percent >= 80) {
    level = "high";
  }

  let fillWidth = 0;
  if (percent !== null) {
    fillWidth = Math.min(percent, 100);
  }

  let percentText = "n/a";
  if (percent !== null) {
    percentText = percent < 1 && percent > 0 ? "<1%" : percent.toFixed(0) + "%";
  }

  let warning = null;
  if (level === "full") {
    warning = <Icon name="alert" size={13} className="meter-alert" />;
  }

  return (
    <div className="meter">
      <div className="meter-head">
        <span className="meter-name" title={props.about}>
          {props.name}
        </span>
        <span className="meter-numbers mono">
          {warning}
          {count(props.used)} / {count(props.limit)} · {percentText}
        </span>
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-label={props.name}
        aria-valuemin={0}
        aria-valuemax={props.limit}
        aria-valuenow={props.used === null ? undefined : props.used}
      >
        <div className={"meter-fill meter-" + level} style={{ width: fillWidth + "%" }}></div>
      </div>
    </div>
  );
}

// FPGA resources for the current design vs the Zynq-7020 limits, from the Vivado sweep.
export default function ResourcesCard(props) {
  const estimate = props.estimate;
  const limits = props.limits;
  const res = estimate.resources;

  let meters = [];
  for (let i = 0; i < RESOURCES.length; i++) {
    const r = RESOURCES[i];
    meters.push(<Meter key={r.key} name={r.name} about={r.about} used={res[r.key]} limit={limits[r.key]} />);
  }

  let fits = "n/a";
  let fitsClass = "stat-value";
  if (res.fits_zynq7020 === true) {
    fits = "Yes";
    fitsClass = "stat-value stat-good";
  } else if (res.fits_zynq7020 === false) {
    fits = "No";
    fitsClass = "stat-value stat-bad";
  }

  // which kind of multiplier Vivado built, from the synthesis numbers
  let multiplierText = null;
  if (res.dsps !== null && res.luts !== null) {
    const pes = estimate.P * estimate.P;
    if (res.dsps >= pes) {
      multiplierText = "All " + pes + " multipliers sit in DSP blocks, so this design clocks high.";
    } else if (res.dsps > 0) {
      multiplierText =
        pes + " multipliers but only " + count(res.dsps) + " in DSPs; the other " +
        (pes - res.dsps) + " are built from LUTs, which slows the clock.";
    } else {
      multiplierText = "All " + pes + " multipliers are built from LUTs (no DSPs), so the clock is lower.";
    }
  }

  // the hardware team's note, unless the line above already says the same thing (DSP spill)
  let estimatedNote = null;
  if (res.estimated) {
    estimatedNote = (
      <p className="resource-estimated">
        <Icon name="info" size={13} /> Estimated, not synthesized: {res.basis}.
      </p>
    );
  }

  let note = null;
  const spillShown = res.dsps !== null && res.dsps > 0 && res.dsps < estimate.P * estimate.P;
  if (estimate.hw_team_note && !spillShown) {
    note = (
      <p className="resource-note">
        <Icon name="alert" size={13} /> {estimate.hw_team_note}
      </p>
    );
  }

  // table view: all 9 designs
  let rows = [];
  if (props.sweep) {
    for (let i = 0; i < props.sweep.designs.length; i++) {
      const d = props.sweep.designs[i];
      rows.push({
        current: d.P === estimate.P && d.bits === estimate.bits,
        cells: [
          shortDesignName(d.P, d.bits),
          count(d.resources.luts),
          count(d.resources.dsps),
          count(d.resources.ffs),
          formatNumber(d.resources.fmax_mhz, 1),
          formatNumber(d.resources.power_w, 3),
        ],
      });
    }
  }

  return (
    <ChartCard
      icon="cpu"
      title="FPGA resources (Zynq-7020)"
      takeaway={multiplierText}
      info={
        <>
          Post-synthesis numbers from the Vivado sweep (results.json), out-of-context on the
          xc7z020. Fmax comes from the worst timing slack; power is Vivado's estimate. Bars turn amber
          above 80% and red at 100% of the chip.
        </>
      }
      table={{ columns: ["Design", "LUTs", "DSPs", "FFs", "Fmax (MHz)", "Power (W)"], rows: rows }}
    >
      <div className="meters">{meters}</div>
      <div className="stat-row">
        <div className="stat">
          <span className="stat-label">Fmax</span>
          <span className="stat-value mono">{formatNumber(res.fmax_mhz, 1)} MHz</span>
        </div>
        <div className="stat">
          <span className="stat-label">Power</span>
          <span className="stat-value mono">{formatNumber(res.power_w, 3)} W</span>
        </div>
        <div className="stat">
          <span className="stat-label">Fits chip</span>
          <span className={fitsClass + " mono"}>{fits}</span>
        </div>
      </div>
      {estimatedNote}
      {note}
    </ChartCard>
  );
}
