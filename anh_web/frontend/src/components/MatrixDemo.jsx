import { useState } from "react";

const A = [
  [1, 2, 0],
  [3, 1, 2],
  [0, 1, 4],
];
const B = [
  [2, 1, 0],
  [1, 3, 1],
  [4, 0, 2],
];

// C = A x B, computed here so the page and the numbers always agree
export function multiply(a, b) {
  const n = a.length;
  let c = [];
  for (let i = 0; i < n; i++) {
    let row = [];
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum = sum + a[i][k] * b[k][j];
      }
      row.push(sum);
    }
    c.push(row);
  }
  return c;
}

function Grid(props) {
  let rows = [];
  for (let i = 0; i < props.values.length; i++) {
    let cells = [];
    for (let j = 0; j < props.values[i].length; j++) {
      let className = "mx-cell";
      if (props.isLit(i, j)) {
        className = className + " mx-lit mx-lit-" + props.tone;
      }
      if (props.onPick) {
        cells.push(
          <button
            key={j}
            type="button"
            className={className + " mx-pick"}
            onClick={() => props.onPick(i, j)}
            aria-label={"Output row " + (i + 1) + ", column " + (j + 1)}
          >
            {props.values[i][j]}
          </button>
        );
      } else {
        cells.push(
          <span key={j} className={className}>
            {props.values[i][j]}
          </span>
        );
      }
    }
    rows.push(
      <div className="mx-row" key={i}>
        {cells}
      </div>
    );
  }
  return (
    <div className="mx-block">
      <div className="mx-grid">{rows}</div>
      <span className="mx-name">{props.name}</span>
    </div>
  );
}

// Click an output cell: its row of A and column of B light up, and the
// multiply-adds that make it are written out.
export default function MatrixDemo() {
  const [pick, setPick] = useState({ i: 0, j: 0 });
  const C = multiply(A, B);

  let terms = [];
  for (let k = 0; k < 3; k++) {
    terms.push(A[pick.i][k] + "×" + B[k][pick.j]);
  }

  return (
    <div className="matrix-demo">
      <div className="mx-equation">
        <Grid name="A" values={A} tone="a" isLit={(i) => i === pick.i} />
        <span className="mx-op">×</span>
        <Grid name="B" values={B} tone="b" isLit={(i, j) => j === pick.j} />
        <span className="mx-op">=</span>
        <Grid
          name="C (click a number)"
          values={C}
          tone="c"
          isLit={(i, j) => i === pick.i && j === pick.j}
          onPick={(i, j) => setPick({ i: i, j: j })}
        />
      </div>
      <p className="mx-sum mono">
        C[{pick.i + 1}][{pick.j + 1}] = {terms.join(" + ")} = <strong>{C[pick.i][pick.j]}</strong>
      </p>
      <p className="mx-note">
        3 multiplies and 3 adds for one number. SmolVLM's vision encoder needs about 1.4 trillion of
        these multiply-adds for one image.
      </p>
    </div>
  );
}
