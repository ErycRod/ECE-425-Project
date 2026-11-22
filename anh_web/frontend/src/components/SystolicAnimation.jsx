import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { getSystolicFrames } from "../api.js";
import { aPosition, bPosition } from "../systolic.js";

// Sizes in SVG units (the drawing scales to fit its box).
const CELL = 78; // one PE
const STEP = 96; // PE + gap
const SLOT_X = 34; // spacing of A values waiting on the left
const SLOT_Y = 30; // spacing of B values waiting on top
const CHIP = 24; // operand chip size

function Chip(props) {
  // positioned with a CSS transform so it slides smoothly between cycles
  return (
    <g
      className={"op-chip op-chip-" + props.tone}
      style={{ transform: "translate(" + props.x + "px, " + props.y + "px)", opacity: props.hidden ? 0 : 1 }}
    >
      <rect x={-CHIP / 2} y={-CHIP / 2} width={CHIP} height={CHIP} rx={6} />
      <text y={4.5} textAnchor="middle">
        {props.value}
      </text>
    </g>
  );
}

// The P x P systolic array multiplying A x B, one clock cycle at a time.
// Data: /api/systolic_frames, recorded from hw/model/systolic_model.py.
export default function SystolicAnimation() {
  const [rec, setRec] = useState(null);
  const [error, setError] = useState(null);
  const [s, setS] = useState(0); // clock cycles done
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const reply = await getSystolicFrames();
      if (cancelled) {
        return;
      }
      if (reply.ok) {
        setRec(reply.data);
      } else {
        setError(reply.error);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // play: one cycle every 1.2 s (at 1x), stop at the end
  useEffect(() => {
    if (!playing || rec === null) {
      return;
    }
    if (s >= rec.cycles) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setS(s + 1), 1200 / speed);
    return () => clearTimeout(timer);
  }, [playing, s, speed, rec]);

  if (error) {
    return <p className="ask-message">Could not load the animation: {error}</p>;
  }
  if (rec === null) {
    return <p className="muted-text">Loading the systolic array…</p>;
  }

  const P = rec.P;
  const K = rec.K;
  const frame = rec.frames[s];
  const reach = K + P - 1; // farthest a value waits before entering
  const left = 40 + reach * SLOT_X;
  const top = 34 + reach * SLOT_Y;
  const width = left + P * STEP + 70;
  const height = top + P * STEP + 50;

  function peX(j) {
    return left + j * STEP;
  }
  function peY(i) {
    return top + i * STEP;
  }

  // ---- PEs ----
  let pes = [];
  for (let i = 0; i < P; i++) {
    for (let j = 0; j < P; j++) {
      const active = frame.active[i][j];
      const done = frame.terms[i][j].length === K;
      let className = "pe";
      if (active) {
        className = className + " pe-active";
      } else if (done) {
        className = className + " pe-done";
      }
      if (picked && picked.i === i && picked.j === j) {
        className = className + " pe-picked";
      }
      let product = null;
      if (active) {
        product = (
          <text x={peX(j) + CELL - 8} y={peY(i) + CELL - 9} className="pe-product" textAnchor="end">
            +{frame.a[i][j]}×{frame.b[i][j]}
          </text>
        );
      }
      pes.push(
        <g
          key={"pe" + i + j}
          className={className}
          onClick={() => setPicked({ i: i, j: j })}
          role="button"
          tabIndex={0}
          aria-label={"PE row " + (i + 1) + " column " + (j + 1) + ", sum " + frame.acc[i][j]}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setPicked({ i: i, j: j });
            }
          }}
        >
          <rect x={peX(j)} y={peY(i)} width={CELL} height={CELL} rx={12} />
          <text x={peX(j) + CELL - 10} y={peY(i) + 44} className="pe-acc" textAnchor="end">
            {frame.acc[i][j]}
          </text>
          {product}
          {done && !active ? (
            <text x={peX(j) + 8} y={peY(i) + CELL - 8} className="pe-check">
              ✓
            </text>
          ) : null}
        </g>
      );
    }
  }

  // arrows between PEs (A goes right, B goes down)
  let arrows = [];
  for (let i = 0; i < P; i++) {
    for (let j = 0; j < P - 1; j++) {
      const x = peX(j) + CELL + 4;
      const y = peY(i) + CELL / 2;
      arrows.push(<path key={"ar" + i + j} d={"M" + x + "," + y + "h10m-4,-4l4,4l-4,4"} className="flow-arrow" />);
    }
  }
  for (let j = 0; j < P; j++) {
    for (let i = 0; i < P - 1; i++) {
      const x = peX(j) + CELL / 2;
      const y = peY(i) + CELL + 4;
      arrows.push(<path key={"ad" + i + j} d={"M" + x + "," + y + "v10m-4,-4l4,4l4,-4"} className="flow-arrow" />);
    }
  }

  // ---- operand chips (keyed by which number they are, so they slide) ----
  let chips = [];
  for (let i = 0; i < P; i++) {
    for (let k = 0; k < K; k++) {
      const col = aPosition(i, k, s);
      let x;
      const y = peY(i) + CELL / 2;
      let hidden = false;
      if (col < 0) {
        x = left - 20 - (-col - 1) * SLOT_X; // waiting on the left (the skew makes a staircase)
      } else if (col < P) {
        x = peX(col) + 18; // inside PE(i, col)
      } else {
        x = peX(P - 1) + CELL + 24; // passed out of the array
        hidden = true;
      }
      chips.push(<Chip key={"a" + i + k} tone="a" value={rec.A[i][k]} x={x} y={y} hidden={hidden} />);
    }
  }
  for (let j = 0; j < P; j++) {
    for (let k = 0; k < K; k++) {
      const row = bPosition(j, k, s);
      const x = peX(j) + CELL / 2;
      let y;
      let hidden = false;
      if (row < 0) {
        y = top - 18 - (-row - 1) * SLOT_Y; // waiting on top
      } else if (row < P) {
        y = peY(row) + 18; // inside PE(row, j)
      } else {
        y = peY(P - 1) + CELL + 22;
        hidden = true;
      }
      chips.push(<Chip key={"b" + j + k} tone="b" value={rec.B[k][j]} x={x} y={y} hidden={hidden} />);
    }
  }

  // ---- what is happening this cycle ----
  let activeCount = 0;
  for (let i = 0; i < P; i++) {
    for (let j = 0; j < P; j++) {
      if (frame.active[i][j]) {
        activeCount = activeCount + 1;
      }
    }
  }
  let caption;
  if (s === 0) {
    caption = (
      <>
        The array is empty. Row 1 of A and column 1 of B go in first; each later row and column
        waits one extra cycle (the <strong>skew</strong>), so matching numbers meet in the right PE.
      </>
    );
  } else if (s === rec.cycles) {
    caption = (
      <>
        <strong>Done in {rec.cycles} cycles</strong> = K + 2P − 2 = {K} + {2 * P} − 2. Every PE holds
        one number of C, the same answer as the matrix multiply in step 2.
      </>
    );
  } else {
    let inputs = "No new numbers go in; the last ones flow through.";
    if (frame.fed) {
      inputs = "Column " + (frame.fed.k + 1) + " of A and row " + (frame.fed.k + 1) + " of B start going in.";
    }
    caption = (
      <>
        <strong>{activeCount} PEs</strong> multiply-add at the same time. {inputs}
      </>
    );
  }

  // ---- the picked PE's sum so far ----
  let terms = [];
  if (picked) {
    terms = frame.terms[picked.i][picked.j];
  }
  let sumText = "nothing yet";
  if (terms.length > 0) {
    let parts = [];
    for (let t = 0; t < terms.length; t++) {
      parts.push(terms[t][0] + "×" + terms[t][1]);
    }
    sumText = parts.join(" + ") + " = " + frame.acc[picked.i][picked.j];
    if (terms.length < K) {
      sumText = sumText + "  (" + (K - terms.length) + " more to come)";
    }
  }

  return (
    <div className="systolic">
      <div className="systolic-controls">
        <button type="button" className="chip-button" onClick={() => { setPlaying(false); setS(0); }} aria-label="Back to the start">
          ⟲ Reset
        </button>
        <button type="button" className="chip-button" disabled={s === 0} onClick={() => { setPlaying(false); setS(s - 1); }}>
          ← Step
        </button>
        <button
          type="button"
          className="button-primary systolic-play"
          onClick={() => {
            if (s >= rec.cycles) {
              setS(0);
            }
            setPlaying(!playing);
          }}
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button type="button" className="chip-button" disabled={s >= rec.cycles} onClick={() => { setPlaying(false); setS(s + 1); }}>
          Step →
        </button>
        <span className="systolic-speed">
          {[0.5, 1, 2].map((value) => (
            <button
              key={value}
              type="button"
              className={speed === value ? "chip-button chip-button-on" : "chip-button"}
              onClick={() => setSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </span>
        <span className="systolic-cycle mono">
          cycle {s} / {rec.cycles}
        </span>
      </div>

      <svg
        className="systolic-svg"
        viewBox={"0 0 " + width + " " + height}
        role="img"
        aria-label={"Systolic array at cycle " + s + " of " + rec.cycles}
      >
        <text x={left - 20} y={top - 8} className="systolic-label" textAnchor="end">
          A →
        </text>
        <text x={left + P * STEP - 8} y={top - reach * SLOT_Y - 6} className="systolic-label" textAnchor="end">
          B ↓
        </text>
        {arrows}
        {pes}
        {chips}
      </svg>

      <p className="systolic-caption">{caption}</p>
      <p className="systolic-sum mono">
        {picked
          ? "PE(" + (picked.i + 1) + "," + (picked.j + 1) + ") builds C[" + (picked.i + 1) + "][" +
            (picked.j + 1) + "]: " + sumText
          : "Click a PE to see the multiply-adds that build its number."}
      </p>
      <p className="systolic-note">
        <Icon name="code" size={13} /> Recorded cycle by cycle from <span className="mono">hw/model/systolic_model.py</span>,
        the Python copy of our Verilog (see <a href="#/code">Code</a>). Click any PE to see its sum.
      </p>
    </div>
  );
}
