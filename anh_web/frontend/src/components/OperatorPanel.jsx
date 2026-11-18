import { useState } from "react";
import Icon from "./Icon.jsx";
import InfoTip from "./InfoTip.jsx";

// Sidebar with the hardware controls: array size P, bits, memory bandwidth,
// and the advanced settings (clock, utilization, output tokens).
export default function OperatorPanel(props) {
  const config = props.config;
  const [showAdvanced, setShowAdvanced] = useState(false);

  // P pills
  let pButtons = [];
  for (let i = 0; i < config.allowed_P.length; i++) {
    const P = config.allowed_P[i];
    let className = "pill";
    if (P === props.P) {
      className = "pill pill-selected";
    }
    pButtons.push(
      <button key={P} className={className} onClick={() => props.onPChange(P)}>
        {P}×{P}
      </button>
    );
  }

  // bits pills, each in its own bit colour
  let bitsButtons = [];
  for (let i = 0; i < config.allowed_bits.length; i++) {
    const bits = config.allowed_bits[i];
    let className = "pill pill-bits-" + bits;
    if (bits === props.bits) {
      className = className + " pill-selected";
    }
    bitsButtons.push(
      <button key={bits} className={className} onClick={() => props.onBitsChange(bits)}>
        {bits}-bit
      </button>
    );
  }

  // bandwidth slider
  const bw = config.bandwidth;
  const fillPercent = ((props.bwGbs - bw.min) / (bw.max - bw.min)) * 100;

  function handleSlider(event) {
    const value = parseFloat(event.target.value);
    // keep 2 decimals so 0.05 steps don't turn into 1.0500000001
    props.onBwChange(Math.round(value * 100) / 100);
  }

  // clock default text, from the backend's answer
  let clockHint = "default " + config.defaults.f_mhz + " MHz";
  if (props.estimate && props.advanced.fMhz === "") {
    clockHint = props.estimate.f_mhz + " MHz from " + props.estimate.f_mhz_source;
  }

  let advancedArrow = "▸";
  if (showAdvanced) {
    advancedArrow = "▾";
  }

  let advancedSection = null;
  if (showAdvanced) {
    advancedSection = (
      <div className="advanced">
        <label className="field">
          <span className="field-label">Clock (MHz)</span>
          <input
            className="field-input mono"
            type="number"
            min="1"
            step="1"
            placeholder={String(config.defaults.f_mhz)}
            value={props.advanced.fMhz}
            onChange={(event) => props.onAdvancedChange("fMhz", event.target.value)}
          />
          <span className="field-hint">{clockHint}</span>
        </label>

        <label className="field">
          <span className="field-label">Utilization (0–1)</span>
          <input
            className="field-input mono"
            type="number"
            min="0.05"
            max="1"
            step="0.05"
            placeholder={String(config.defaults.util)}
            value={props.advanced.util}
            onChange={(event) => props.onAdvancedChange("util", event.target.value)}
          />
          <span className="field-hint">default {config.defaults.util}</span>
        </label>

        <label className="field">
          <span className="field-label">Output tokens</span>
          <input
            className="field-input mono"
            type="number"
            min="1"
            step="1"
            placeholder={String(config.defaults.out_tokens)}
            value={props.advanced.outTokens}
            onChange={(event) => props.onAdvancedChange("outTokens", event.target.value)}
          />
          <span className="field-hint">default {config.defaults.out_tokens}</span>
        </label>

        <button className="reset-button" onClick={props.onReset}>
          Reset to defaults
        </button>
      </div>
    );
  }

  return (
    <aside className="operator-panel">
      <div className="panel-section">
        <h2 className="card-title card-title-icon">
          <Icon name="grid" size={14} /> Array size (P×P)
          <InfoTip label="About array size">
            P×P multiply-add units working in parallel. More units finish the big matrix multiplies
            (vision, prefill) sooner.
          </InfoTip>
        </h2>
        <div className="pill-group">{pButtons}</div>
      </div>

      <div className="panel-section">
        <h2 className="card-title card-title-icon">
          <Icon name="binary" size={14} /> Bits per weight
          <InfoTip label="About bits per weight">
            How many bits store each model weight. Fewer bits = fewer bytes to read per word, but on
            this FPGA 8- and 4-bit multipliers are built from LUTs and clock lower.
          </InfoTip>
        </h2>
        <div className="pill-group">{bitsButtons}</div>
      </div>

      <div className="panel-section">
        <div className="slider-header">
          <h2 className="card-title card-title-icon">
            <Icon name="memory" size={14} /> Bandwidth
            <InfoTip label="About memory bandwidth">
              How fast weights move from DRAM into the FPGA. Decode re-reads every weight for each
              word, so this sets the decode speed until the array becomes the limit.
            </InfoTip>
          </h2>
          <span className="slider-value mono">{props.bwGbs.toFixed(2)} GB/s</span>
        </div>
        <input
          className="slider"
          type="range"
          min={bw.min}
          max={bw.max}
          step={bw.step}
          value={props.bwGbs}
          onChange={handleSlider}
          style={{ "--fill": fillPercent + "%" }}
        />
        <div className="slider-scale mono">
          <span>{bw.min}</span>
          <span>{bw.max}</span>
        </div>
      </div>

      <div className="panel-section">
        <button className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
          <span>{advancedArrow}</span> Advanced
        </button>
        {advancedSection}
      </div>

      <Lesson />
    </aside>
  );
}

// "The main lesson" box: the two rules of thumb. (The 16- vs 8-bit clock "twist"
// is left out here because the Intermediate tasks ask about it.)
function Lesson() {
  return (
    <div className="lesson">
      <h2 className="card-title card-title-icon">
        <Icon name="book" size={14} /> The main lesson
      </h2>
      <ul className="lesson-list">
        <li>
          <Icon name="grid" size={14} /> <strong>Bigger array</strong> → first word sooner
          <span className="lesson-why"> (prefill is compute-bound)</span>
        </li>
        <li>
          <Icon name="binary" size={14} /> <strong>Fewer bits</strong> → talks faster
          <span className="lesson-why"> (decode is memory-bound)</span>
        </li>
      </ul>
    </div>
  );
}
