import { useEffect, useState } from "react";
import ChartCard from "./ChartCard.jsx";
import { getCustomValidation } from "../api.js";

function percent(value) {
  let sign = "";
  if (value > 0) {
    sign = "+";
  }
  return sign + value.toFixed(1) + "%";
}

// "How good are the estimates?": each 8-/4-bit design predicted from the other two.
export default function EstimateCheckCard() {
  const [check, setCheck] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const reply = await getCustomValidation();
      if (!cancelled && reply.ok) {
        setCheck(reply.data);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (check === null) {
    return null;
  }

  let rows = [];
  for (let i = 0; i < check.checks.length; i++) {
    const c = check.checks[i];
    rows.push({
      title:
        "LUTs " + Math.round(c.luts.predicted) + " predicted vs " + Math.round(c.luts.actual) +
        " in Vivado; power " + c.power_w.predicted.toFixed(3) + " W vs " + c.power_w.actual.toFixed(3) + " W",
      cells: [
        c.P + "×" + c.P + "/" + c.bits + "-bit",
        percent(c.luts.error_pct),
        percent(c.ffs.error_pct),
        percent(c.power_w.error_pct),
      ],
    });
  }

  let tableRows = [];
  for (let i = 0; i < rows.length; i++) {
    let cells = [];
    for (let j = 0; j < rows[i].cells.length; j++) {
      cells.push(<td key={j}>{rows[i].cells[j]}</td>);
    }
    tableRows.push(
      <tr key={i} title={rows[i].title}>
        {cells}
      </tr>
    );
  }

  // sizes synthesized only to test the estimates (hw/scripts/check_estimate.py)
  let newSizes = null;
  const checks = check.new_size_checks || [];
  if (checks.length > 0) {
    let newRows = [];
    for (let i = 0; i < checks.length; i++) {
      const c = checks[i];
      const e = c.error_pct || {};
      newRows.push(
        <tr key={i} title={"Vivado: " + JSON.stringify(c.vivado) + " / estimate: " + JSON.stringify(c.estimate)}>
          <td>{c.P + "×" + c.P + "/" + c.bits + "-bit"}</td>
          <td>{e.luts === null || e.luts === undefined ? "–" : percent(e.luts)}</td>
          <td>{e.fmax_mhz === null || e.fmax_mhz === undefined ? "–" : percent(e.fmax_mhz)}</td>
          <td>{e.power_w === null || e.power_w === undefined ? "–" : percent(e.power_w)}</td>
        </tr>
      );
    }
    newSizes = (
      <>
        <h3 className="card-title check-subtitle">New sizes, synthesized in Vivado only to test the estimates</h3>
        <div className="table-wrap">
          <table className="data-table mono">
            <thead>
              <tr>
                <th>New design</th>
                <th>LUTs</th>
                <th>Fmax</th>
                <th>Power</th>
              </tr>
            </thead>
            <tbody>{newRows}</tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <ChartCard
      icon="check"
      title="How good are the estimates?"
      takeaway={
        <>
          Predicting each synthesized 8- and 4-bit design from the other two lands within{" "}
          <strong>{check.worst_error_pct.toFixed(1)}%</strong> of what Vivado reported.
        </>
      }
      info={
        <>
          Leave-one-out test: fit the LUT, flip-flop and power lines on two designs of a bit width,
          predict the third, and compare with Vivado (the table shows the error; hover a row for the
          numbers). 16-bit can't be checked this way (only two of
          its designs fit in DSPs), and sizes above 16×16 are extrapolation, so treat those with care.
        </>
      }
    >
      <div className="table-wrap">
        <table className="data-table mono">
          <thead>
            <tr>
              <th>Predicted design</th>
              <th>LUTs</th>
              <th>Flip-flops</th>
              <th>Power</th>
            </tr>
          </thead>
          <tbody>{tableRows}</tbody>
        </table>
      </div>
      {newSizes}
    </ChartCard>
  );
}
