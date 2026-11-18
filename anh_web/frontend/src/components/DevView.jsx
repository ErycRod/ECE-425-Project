import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { getSource } from "../api.js";
import { highlightLine } from "../highlight.js";
import { formatSeconds, formatRate } from "../format.js";

const TABS = [
  { key: "math", label: "Roofline math" },
  { key: "verilog", label: "Verilog" },
  { key: "python", label: "Python model" },
  { key: "json", label: "API JSON" },
];

const FILES = {
  verilog: ["systolic_array.v", "mac_pe.v", "tb_systolic_array.v"],
  python: ["perf_model.py", "systolic_model.py"],
};

// 1395646267392 -> 1.396 × 10^12 (as JSX)
function Sci(props) {
  const value = props.value;
  if (value === 0) {
    return <span className="mono">0</span>;
  }
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp >= -2 && exp <= 4) {
    return <span className="mono">{Number(value.toPrecision(4)).toLocaleString("en-US")}</span>;
  }
  const mantissa = value / Math.pow(10, exp);
  return (
    <span className="mono">
      {mantissa.toFixed(3)}×10<sup>{exp}</sup>
    </span>
  );
}

// Same arithmetic as perf_model.py phase_time(), shown step by step.
export function rooflineSteps(estimate) {
  const w = estimate.workload;
  const f = estimate.f_mhz * 1e6;
  const bw = estimate.bw_gbs * 1e9;
  const u = estimate.util;
  const P = estimate.P;
  const bytesPerWeight = estimate.bits / 8;
  const peRate = P * P * f * u;

  const phases = [
    { key: "vision", name: "Vision encoder", macs: w.vision_macs, bytes: w.vision_params * bytesPerWeight,
      macsText: "vision MACs", bytesText: "vision params × " + bytesPerWeight + " B" },
    { key: "prefill", name: "LM prefill", macs: w.lm_params * w.prefill_tokens, bytes: w.lm_params * bytesPerWeight,
      macsText: "LM params × " + w.prefill_tokens + " tokens", bytesText: "LM params × " + bytesPerWeight + " B" },
    { key: "decode", name: "Decode (1 token)", macs: w.lm_params, bytes: w.lm_params * bytesPerWeight,
      macsText: "LM params × 1 token", bytesText: "LM params × " + bytesPerWeight + " B" },
  ];

  let steps = [];
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const tCompute = p.macs / peRate;
    const tMemory = p.bytes / bw;
    const t = Math.max(tCompute, tMemory);
    let bound = "memory";
    if (tCompute >= tMemory) {
      bound = "compute";
    }
    const backend = estimate.phases[p.key].time_s;
    const matches = Math.abs(t - backend) <= 1e-9 * Math.max(1, Math.abs(backend));
    steps.push({ ...p, tCompute: tCompute, tMemory: tMemory, t: t, bound: bound, backend: backend, matches: matches });
  }
  return { steps: steps, peRate: peRate };
}

function MathTab(props) {
  const e = props.estimate;
  const result = rooflineSteps(e);

  let rows = [];
  for (let i = 0; i < result.steps.length; i++) {
    const s = result.steps[i];
    rows.push(
      <tr key={s.key}>
        <td>{s.name}</td>
        <td>
          <Sci value={s.macs} /> <span className="dim">({s.macsText})</span>
        </td>
        <td className={s.bound === "compute" ? "win" : ""}>{formatSeconds(s.tCompute)} s</td>
        <td>
          <Sci value={s.bytes} /> B <span className="dim">({s.bytesText})</span>
        </td>
        <td className={s.bound === "memory" ? "win" : ""}>{formatSeconds(s.tMemory)} s</td>
        <td>
          <span className={"bound-label mono bound-label-" + s.bound}>{s.bound.toUpperCase()}</span>
        </td>
        <td className="mono">
          {s.matches ? <Icon name="check" size={13} className="ok-icon" /> : <Icon name="alert" size={13} />}
        </td>
      </tr>
    );
  }

  const decode = result.steps[2];
  const ttft = result.steps[0].t + result.steps[1].t + decode.t;

  return (
    <div className="dev-math">
      <div className="formula mono">
        t<sub>phase</sub> = max( MACs ÷ (P² · f · u) , bytes ÷ BW )
      </div>
      <div className="formula-values mono">
        P² · f · u = {e.P}² · {e.f_mhz} MHz · {e.util} = <Sci value={result.peRate} /> MAC/s
        <span className="dim"> · </span>
        BW = {e.bw_gbs.toFixed(2)} GB/s <span className="dim"> · </span>
        bytes per weight = {e.bits}/8 = {e.bits / 8}
      </div>
      <div className="table-wrap">
        <table className="data-table dev-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>MACs</th>
              <th>Compute time</th>
              <th>Bytes moved</th>
              <th>Memory time</th>
              <th>Bound</th>
              <th title="Same as the backend's number">=API</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
      <div className="formula-values mono">
        TTFT = vision + prefill + 1 decode = {formatSeconds(ttft)} s
        <span className="dim"> · </span>
        tokens/s = 1 ÷ t<sub>decode</sub> = {formatRate(1 / decode.t)}
        <span className="dim"> · </span>
        answer = vision + prefill + {e.out_tokens} × decode = {formatSeconds(e.answer_s)} s
      </div>
      <p className="dev-note">
        The larger of the two times wins (highlighted). The check column recomputes each phase in the
        browser and compares it with <span className="mono">/api/estimate</span>, which calls{" "}
        <span className="mono">perf/perf_model.py</span>.
      </p>
    </div>
  );
}

function CodeTab(props) {
  const files = FILES[props.kind];
  const [name, setName] = useState(files[0]);
  const [cache, setCache] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cache[name]) {
      return;
    }
    let cancelled = false;
    async function load() {
      const reply = await getSource(name);
      if (cancelled) {
        return;
      }
      if (reply.ok) {
        const copy = { ...cache };
        copy[name] = reply.data;
        setCache(copy);
        setError(null);
      } else {
        setError(reply.error);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [name, cache]);

  let buttons = [];
  for (let i = 0; i < files.length; i++) {
    let className = "tab";
    if (files[i] === name) {
      className = "tab tab-on";
    }
    buttons.push(
      <button key={files[i]} className={className} type="button" onClick={() => setName(files[i])}>
        {files[i]}
      </button>
    );
  }

  // the line that builds the current design, with its numbers filled in
  let instance = null;
  if (props.kind === "verilog" && props.estimate) {
    const e = props.estimate;
    instance = (
      <div className="instance mono">
        <span className="dim">// this design:</span> systolic_array #(.P(<b>{e.P}</b>), .B(<b>{e.bits}</b>)) →{" "}
        {e.P * e.P} PEs, ACC = 2·{e.bits}+12 = <b>{2 * e.bits + 12}</b> bits
      </div>
    );
  }

  let body;
  const file = cache[name];
  if (error) {
    body = <p className="ask-message">{error}</p>;
  } else if (!file) {
    body = <p className="muted-text">Loading {name}…</p>;
  } else {
    const lines = file.text.replace(/\n$/, "").split("\n");
    let state = { inDocstring: false };
    let rendered = [];
    for (let i = 0; i < lines.length; i++) {
      rendered.push(
        <div className="code-line" key={i}>
          <span className="line-no">{i + 1}</span>
          <span className="line-text">{highlightLine(lines[i], file.language, state)}</span>
        </div>
      );
    }
    body = (
      <>
        <div className="code-head">
          <span className="mono">{file.path}</span>
          <span className="dim"> · {lines.length} lines · {file.about}</span>
        </div>
        <pre className="code-block mono">{rendered}</pre>
      </>
    );
  }

  return (
    <div>
      <div className="tabs">{buttons}</div>
      {instance}
      {body}
    </div>
  );
}

function JsonTab(props) {
  const body = JSON.stringify(props.request, null, 2);
  const curl =
    "curl -X POST http://127.0.0.1:8000/api/estimate -H \"Content-Type: application/json\" -d '" +
    JSON.stringify(props.request) + "'";
  const shown = { ...props.estimate };
  delete shown.flags; // long and not about this design
  return (
    <div className="json-grid">
      <div>
        <div className="code-head mono">POST /api/estimate (request)</div>
        <pre className="code-block mono">{body}</pre>
        <div className="code-head mono">same call from a terminal</div>
        <pre className="code-block mono wrap">{curl}</pre>
      </div>
      <div>
        <div className="code-head mono">response</div>
        <pre className="code-block mono json-response">{JSON.stringify(shown, null, 2)}</pre>
      </div>
    </div>
  );
}

// Developer view: the code and the math behind the numbers on the page.
export default function DevView(props) {
  const [tab, setTab] = useState("math");

  let tabButtons = [];
  for (let i = 0; i < TABS.length; i++) {
    let className = "tab";
    if (TABS[i].key === tab) {
      className = "tab tab-on";
    }
    tabButtons.push(
      <button key={TABS[i].key} className={className} type="button" onClick={() => setTab(TABS[i].key)}>
        {TABS[i].label}
      </button>
    );
  }

  let content = null;
  if (!props.estimate) {
    content = <p className="muted-text">Waiting for the backend…</p>;
  } else if (tab === "math") {
    content = <MathTab estimate={props.estimate} />;
  } else if (tab === "verilog" || tab === "python") {
    content = <CodeTab key={tab} kind={tab} estimate={props.estimate} />;
  } else {
    content = <JsonTab estimate={props.estimate} request={props.request} />;
  }

  return (
    <section className="card dev-view">
      <div className="card-header">
        <h2 className="card-title card-title-icon">
          <Icon name="code" size={15} /> Developer view
        </h2>
        {props.onClose ? (
          <button className="chip-button" type="button" onClick={props.onClose}>
            Close
          </button>
        ) : null}
      </div>
      <div className="tabs tabs-main">{tabButtons}</div>
      {content}
    </section>
  );
}
