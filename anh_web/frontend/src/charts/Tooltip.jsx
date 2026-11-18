// Floating readout for charts. `tip` is { x, y, title, rows: [{ color, label, value }] }
// with x / y in pixels inside the chart box. Text is rendered by React (never as HTML).
export default function Tooltip(props) {
  const tip = props.tip;
  if (!tip) {
    return null;
  }

  // keep the box inside the chart: flip to the left near the right edge
  let left = tip.x + 14;
  let transform = "translateY(-50%)";
  if (props.width && tip.x > props.width * 0.6) {
    left = tip.x - 14;
    transform = "translate(-100%, -50%)";
  }

  let rows = [];
  for (let i = 0; i < tip.rows.length; i++) {
    const row = tip.rows[i];
    let key = null;
    if (row.color) {
      key = <span className="tip-key" style={{ background: row.color }}></span>;
    }
    rows.push(
      <div className="tip-row" key={i}>
        {key}
        <span className="tip-value mono">{row.value}</span>
        <span className="tip-label">{row.label}</span>
      </div>
    );
  }

  return (
    <div className="chart-tip" style={{ left: left, top: tip.y, transform: transform }}>
      <div className="tip-title">{tip.title}</div>
      {rows}
    </div>
  );
}
