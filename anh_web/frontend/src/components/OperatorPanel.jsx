import { useState } from "react";

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
        <h2 className="card-title">Array size (P×P)</h2>
        <div className="pill-group">{pButtons}</div>
      </div>

      <div className="panel-section">
        <h2 className="card-title">Bits per weight</h2>
        <div className="pill-group">{bitsButtons}</div>
      </div>

      <div className="panel-section">
        <div className="slider-header">
          <h2 className="card-title">Memory bandwidth</h2>
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

      <div className="lesson">
        <h2 className="card-title">The main lesson</h2>
        <p>
          A bigger array makes the first word come sooner (prefill is compute-bound), but it
          doesn't make the model talk faster. Fewer bits do (decode is memory-bound).
        </p>
      </div>
    </aside>
  );
}
