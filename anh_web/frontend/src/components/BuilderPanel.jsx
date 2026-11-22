import Icon from "./Icon.jsx";
import InfoTip from "./InfoTip.jsx";

const BITS = [16, 8, 4];
const SYNTHESIZED_P = [4, 8, 16];

// Controls for the Advanced level: any array size from 2 to 32, bits, bandwidth, clock.
export default function BuilderPanel(props) {
  const pFill = ((props.P - props.minP) / (props.maxP - props.minP)) * 100;
  const bwFill = ((props.bwGbs - 0.25) / (4 - 0.25)) * 100;

  let quick = [];
  for (let i = 0; i < SYNTHESIZED_P.length; i++) {
    const P = SYNTHESIZED_P[i];
    quick.push(
      <button
        key={P}
        type="button"
        className={P === props.P ? "chip-button chip-button-on" : "chip-button"}
        onClick={() => props.onChange({ P: P })}
      >
        {P}×{P}
      </button>
    );
  }

  let bitButtons = [];
  for (let i = 0; i < BITS.length; i++) {
    const bits = BITS[i];
    let className = "pill pill-bits-" + bits;
    if (bits === props.bits) {
      className = className + " pill-selected";
    }
    bitButtons.push(
      <button key={bits} type="button" className={className} onClick={() => props.onChange({ bits: bits })}>
        {bits}-bit
      </button>
    );
  }

  return (
    <section className="card builder-panel">
      <h2 className="card-title card-title-icon">
        <Icon name="cpu" size={15} /> Build your accelerator <span className="bloom-tag">Create</span>
      </h2>

      <div className="panel-section">
        <div className="slider-header">
          <h3 className="card-title card-title-icon">
            <Icon name="grid" size={14} /> Array size
            <InfoTip label="About array size">
              Any P from {props.minP} to {props.maxP}. The team synthesized 4×4, 8×8 and 16×16 in
              Vivado; every other size is estimated from those 9 designs.
            </InfoTip>
          </h3>
          <span className="slider-value mono">
            {props.P}×{props.P}
          </span>
        </div>
        <input
          className="slider"
          type="range"
          min={props.minP}
          max={props.maxP}
          step={1}
          value={props.P}
          aria-label="Array size P"
          onChange={(event) => props.onChange({ P: Number(event.target.value) })}
          style={{ "--fill": pFill + "%" }}
        />
        <div className="builder-hint">
          <span className="mono">{props.P * props.P} PEs</span>
          <span className="builder-quick">
            synthesized: {quick}
          </span>
        </div>
      </div>

      <div className="panel-section">
        <h3 className="card-title card-title-icon">
          <Icon name="binary" size={14} /> Bits per weight
        </h3>
        <div className="pill-group">{bitButtons}</div>
      </div>

      <div className="panel-section">
        <div className="slider-header">
          <h3 className="card-title card-title-icon">
            <Icon name="memory" size={14} /> Bandwidth
          </h3>
          <span className="slider-value mono">{props.bwGbs.toFixed(2)} GB/s</span>
        </div>
        <input
          className="slider"
          type="range"
          min={0.25}
          max={4}
          step={0.05}
          value={props.bwGbs}
          aria-label="Memory bandwidth"
          onChange={(event) => props.onChange({ bwGbs: Number(event.target.value) })}
          style={{ "--fill": bwFill + "%" }}
        />
      </div>

      <label className="field">
        <span className="field-label">Clock (MHz, optional)</span>
        <input
          className="field-input mono"
          type="number"
          min="1"
          placeholder={"estimated: " + (props.estimatedClock ? props.estimatedClock.toFixed(1) : "…")}
          value={props.clockText}
          onChange={(event) => props.onChange({ clockText: event.target.value })}
        />
        <span className="field-hint">Leave empty to use the estimated Fmax for this design.</span>
      </label>
    </section>
  );
}
