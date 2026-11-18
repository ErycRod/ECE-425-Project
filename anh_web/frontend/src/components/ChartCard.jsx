import { useState } from "react";
import Icon from "./Icon.jsx";
import InfoTip from "./InfoTip.jsx";

// Card frame shared by every chart: icon + title, an info tip, a one-line
// takeaway, and a "Table" button that swaps the chart for the same numbers as a table
// (so nothing is only readable by colour or by hovering).
//
// props: icon, title, info (JSX), takeaway (JSX), table ({ columns, rows }), wide, children
export default function ChartCard(props) {
  const [showTable, setShowTable] = useState(false);

  let className = "card chart-card";
  if (props.wide) {
    className = className + " span-2";
  }

  let tableButton = null;
  if (props.table) {
    let buttonClass = "chip-button";
    if (showTable) {
      buttonClass = buttonClass + " chip-button-on";
    }
    tableButton = (
      <button
        className={buttonClass}
        type="button"
        onClick={() => setShowTable(!showTable)}
        aria-pressed={showTable}
      >
        <Icon name="table" size={13} /> Table
      </button>
    );
  }

  let info = null;
  if (props.info) {
    info = (
      <InfoTip label={"About " + props.title} align="right">
        {props.info}
      </InfoTip>
    );
  }

  let takeaway = null;
  if (props.takeaway) {
    takeaway = <p className="chart-takeaway">{props.takeaway}</p>;
  }

  let body = props.children;
  if (showTable && props.table) {
    body = <DataTable columns={props.table.columns} rows={props.table.rows} />;
  }

  return (
    <section className={className}>
      <div className="card-header">
        <h2 className="card-title card-title-icon">
          <Icon name={props.icon} size={15} />
          {props.title}
        </h2>
        <div className="card-actions">
          {tableButton}
          {info}
        </div>
      </div>
      {takeaway}
      {body}
    </section>
  );
}

function DataTable(props) {
  let headCells = [];
  for (let i = 0; i < props.columns.length; i++) {
    headCells.push(<th key={i}>{props.columns[i]}</th>);
  }

  let bodyRows = [];
  for (let r = 0; r < props.rows.length; r++) {
    const row = props.rows[r];
    let cells = [];
    for (let c = 0; c < row.cells.length; c++) {
      cells.push(<td key={c}>{row.cells[c]}</td>);
    }
    let rowClass = "";
    if (row.current) {
      rowClass = "row-current";
    }
    bodyRows.push(
      <tr key={r} className={rowClass}>
        {cells}
      </tr>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table mono">
        <thead>
          <tr>{headCells}</tr>
        </thead>
        <tbody>{bodyRows}</tbody>
      </table>
    </div>
  );
}
