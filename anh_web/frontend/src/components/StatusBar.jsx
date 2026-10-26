import { useEffect, useRef, useState } from "react";
import { designLabel } from "../format.js";

// "Zynq-7020 (xc7z020clg484-1)" -> "xc7z020clg484-1"
function partNumber(chipText) {
  const start = chipText.indexOf("(");
  const end = chipText.indexOf(")");
  if (start === -1 || end === -1 || end < start) {
    return chipText;
  }
  return chipText.substring(start + 1, end);
}

function formatCount(value) {
  if (value === null || value === undefined) {
    return "n/a";
  }
  return value.toLocaleString("en-US");
}

// Small panel that explains what the target chip is.
function ChipInfo(props) {
  const config = props.config;
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // close the panel when clicking anywhere else
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleClick(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  let panel = null;
  if (open && config) {
    const limits = config.chip_limits;
    panel = (
      <div className="chip-panel">
        <p>
          <strong>Zynq-7020 FPGA</strong>: the chip all 9 designs are built for (a small,
          low-cost AMD Xilinx FPGA).
        </p>
        <p>
          Part number <span className="mono">{partNumber(config.chip)}</span> = device xc7z020 ·
          package clg484 (484 pins) · speed grade -1 (slowest grade).
        </p>
        <p>
          <strong>Chip limits:</strong>{" "}
          <span className="mono">
            {formatCount(limits.luts)} LUTs · {formatCount(limits.dsps)} DSPs ·{" "}
            {formatCount(limits.ffs)} FFs · {formatCount(limits.bram)} BRAM tiles
          </span>
        </p>
        <p className="chip-panel-note">
          Limits as used in the hardware team's run_sweep.py.
        </p>
      </div>
    );
  }

  let buttonClass = "info-button";
  if (open) {
    buttonClass = "info-button info-button-open";
  }

  return (
    <span className="chip-info" ref={boxRef}>
      <span className="status-muted">Target chip: Zynq-7020 FPGA</span>
      <button
        className={buttonClass}
        onClick={() => setOpen(!open)}
        aria-label="What is the Zynq-7020?"
        aria-expanded={open}
      >
        i
      </button>
      {panel}
    </span>
  );
}

// Top bar: title, chip, current design, backend lamp, placeholder alert.
export default function StatusBar(props) {
  const config = props.config;
  const flags = props.flags;

  let designText = "";
  if (props.design) {
    designText = designLabel(props.design, props.P, props.bits);
  }

  // backend lamp
  let lampClass = "lamp lamp-wait";
  let lampText = "Connecting to backend";
  if (props.online === true) {
    lampClass = "lamp lamp-ok";
    lampText = "Backend online";
  } else if (props.online === false) {
    lampClass = "lamp lamp-alarm";
    lampText = "Backend offline";
  }

  // which data is still placeholder
  let placeholderParts = [];
  if (flags) {
    if (flags.profile_placeholder) {
      placeholderParts.push("workload profile (" + flags.profile_source + ")");
    }
    if (flags.results_placeholder) {
      placeholderParts.push("no Vivado results.json yet");
    }
  }

  let alert = null;
  if (placeholderParts.length > 0) {
    alert = (
      <span className="status-alert" title={placeholderParts.join(", ")}>
        ▲ Placeholder data
      </span>
    );
  }

  return (
    <header className="status-bar">
      <div className="status-left">
        <span className="logo-mark"></span>
        <span className="app-name">EdgeVLM Lab</span>
        <span className="status-divider"></span>
        <ChipInfo config={config} />
      </div>

      <div className="status-center mono">{designText}</div>

      <div className="status-right">
        <span className="status-item">
          <span className={lampClass}></span>
          {lampText}
        </span>
        {alert}
      </div>
    </header>
  );
}
