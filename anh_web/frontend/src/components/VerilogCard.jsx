import { useState } from "react";
import Icon from "./Icon.jsx";
import CodeBlock from "./CodeBlock.jsx";

// "Create": the Verilog for the user's design, plus the commands that simulate and
// synthesize it with the repo's own scripts.
export default function VerilogCard(props) {
  const [copied, setCopied] = useState(null);

  function copy(text, what) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => {
          setCopied(what);
          setTimeout(() => setCopied(null), 1500);
        },
        () => setCopied(null)
      );
    }
  }

  function download() {
    const blob = new Blob([props.verilog.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = props.verilog.file_name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const steps = [
    { key: "sim", label: "1. Simulate it (Vivado xsim)", text: props.commands.simulate_xsim },
    { key: "iv", label: "   or with Icarus Verilog", text: props.commands.simulate_iverilog },
    { key: "syn", label: "2. Synthesize it for the Zynq-7020", text: props.commands.synthesize },
  ];
  let commandRows = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    commandRows.push(
      <div className="command-row" key={step.key}>
        <span className="command-label">{step.label}</span>
        <code className="command mono">{step.text}</code>
        <button type="button" className="chip-button" onClick={() => copy(step.text, step.key)}>
          {copied === step.key ? "Copied" : "Copy"}
        </button>
      </div>
    );
  }

  return (
    <section className="card verilog-card span-2">
      <div className="card-header">
        <h2 className="card-title card-title-icon">
          <Icon name="code" size={15} /> Your Verilog <span className="bloom-tag">Create</span>
        </h2>
        <div className="card-actions">
          <button type="button" className="chip-button" onClick={() => copy(props.verilog.text, "file")}>
            {copied === "file" ? "Copied" : "Copy"}
          </button>
          <button type="button" className="chip-button" onClick={download}>
            Download {props.verilog.file_name}
          </button>
        </div>
      </div>
      <p className="chart-takeaway">
        A top-level module that builds your {props.P}×{props.P}, {props.bits}-bit array from the team's
        parameterized <span className="mono">systolic_array.v</span>. Run these from the repo folder:
      </p>
      <div className="commands">{commandRows}</div>
      <CodeBlock text={props.verilog.text} language="verilog" />
      <p className="section-note">
        Vivado writes utilization, timing and power reports to <span className="mono">{props.commands.reports}</span>.
        Compare them with the estimates above.
      </p>
    </section>
  );
}
