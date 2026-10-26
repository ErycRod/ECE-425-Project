import { useEffect, useRef, useState } from "react";
import { getConfig, getEstimate, getSweep } from "./api.js";
import { designLabel } from "./format.js";
import StatusBar from "./components/StatusBar.jsx";
import OperatorPanel from "./components/OperatorPanel.jsx";
import KpiCards from "./components/KpiCards.jsx";
import BottleneckLamps from "./components/BottleneckLamps.jsx";
import PlaceholderCard from "./components/PlaceholderCard.jsx";

const DEBOUNCE_MS = 100;
const RETRY_MS = 3000;
const BACKEND_COMMAND =
  ".\\.venv\\Scripts\\python -m uvicorn server:app --app-dir backend --port 8000 --reload";

const EMPTY_ADVANCED = { fMhz: "", util: "", outTokens: "" };

// Turn the controls into the request body for the backend.
// Empty advanced boxes are left out so the backend uses its defaults.
function buildSettings(bwGbs, advanced) {
  const settings = { bw_gbs: bwGbs };

  if (advanced.fMhz !== "") {
    const fMhz = parseFloat(advanced.fMhz);
    if (!Number.isNaN(fMhz)) {
      settings.f_mhz = fMhz;
    }
  }
  if (advanced.util !== "") {
    const util = parseFloat(advanced.util);
    if (!Number.isNaN(util)) {
      settings.util = util;
    }
  }
  if (advanced.outTokens !== "") {
    const outTokens = parseInt(advanced.outTokens, 10);
    if (!Number.isNaN(outTokens)) {
      settings.out_tokens = outTokens;
    }
  }
  return settings;
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [online, setOnline] = useState(null); // null = still checking
  const [retryTick, setRetryTick] = useState(0);

  // controls (start at design 1: 4x4, 16-bit)
  const [P, setP] = useState(4);
  const [bits, setBits] = useState(16);
  const [bwGbs, setBwGbs] = useState(1.0);
  const [advanced, setAdvanced] = useState(EMPTY_ADVANCED);

  // results from the backend
  const [estimate, setEstimate] = useState(null);
  const [sweep, setSweep] = useState(null);
  const [inputError, setInputError] = useState(null);

  // so an old, slow reply can't overwrite a newer one
  const requestNumber = useRef(0);

  // load the config (and try again every few seconds while offline)
  useEffect(() => {
    if (config !== null) {
      return;
    }
    async function loadConfig() {
      const reply = await getConfig();
      if (reply.ok) {
        setConfig(reply.data);
        setBwGbs(reply.data.bandwidth.default);
        setOnline(true);
      } else {
        setOnline(false);
      }
    }
    loadConfig();
  }, [retryTick, config]);

  useEffect(() => {
    if (online !== false) {
      return;
    }
    const timer = setInterval(() => {
      setRetryTick((oldValue) => oldValue + 1);
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [online]);

  // ask the backend for new numbers, 100 ms after the last change
  useEffect(() => {
    if (config === null) {
      return;
    }

    const timer = setTimeout(async () => {
      requestNumber.current = requestNumber.current + 1;
      const myNumber = requestNumber.current;

      const settings = buildSettings(bwGbs, advanced);
      const estimateBody = { ...settings, P: P, bits: bits };

      const replies = await Promise.all([getEstimate(estimateBody), getSweep(settings)]);
      const estimateReply = replies[0];
      const sweepReply = replies[1];

      if (myNumber !== requestNumber.current) {
        return; // a newer request has started
      }

      if (estimateReply.ok && sweepReply.ok) {
        setEstimate(estimateReply.data);
        setSweep(sweepReply.data);
        setInputError(null);
        setOnline(true);
      } else if (estimateReply.offline || sweepReply.offline) {
        setOnline(false);
      } else {
        // backend said the input is not allowed (422)
        let message = estimateReply.error;
        if (estimateReply.ok) {
          message = sweepReply.error;
        }
        setInputError(message);
        setOnline(true);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [config, P, bits, bwGbs, advanced, retryTick]);

  function handleAdvancedChange(name, value) {
    const newAdvanced = { ...advanced };
    newAdvanced[name] = value;
    setAdvanced(newAdvanced);
  }

  function handleReset() {
    setAdvanced(EMPTY_ADVANCED);
  }

  // flags come with every reply; use the newest we have
  let flags = null;
  if (estimate) {
    flags = estimate.flags;
  } else if (config) {
    flags = config.flags;
  }

  let design = null;
  if (estimate) {
    design = estimate.design;
  }

  // sidebar
  let sidebar;
  if (config) {
    sidebar = (
      <OperatorPanel
        config={config}
        P={P}
        bits={bits}
        bwGbs={bwGbs}
        advanced={advanced}
        estimate={estimate}
        onPChange={setP}
        onBitsChange={setBits}
        onBwChange={setBwGbs}
        onAdvancedChange={handleAdvancedChange}
        onReset={handleReset}
      />
    );
  } else {
    sidebar = (
      <aside className="operator-panel">
        <p className="muted-text">Waiting for the backend…</p>
      </aside>
    );
  }

  // messages above the cards
  let offlineMessage = null;
  if (online === false) {
    offlineMessage = (
      <div className="alarm-strip">
        <strong>Backend offline.</strong> Start it from the <span className="mono">anh_web</span>{" "}
        folder:
        <code className="command mono">{BACKEND_COMMAND}</code>
      </div>
    );
  }

  let errorMessage = null;
  if (inputError) {
    errorMessage = (
      <div className="warn-strip">
        <strong>Check the advanced settings:</strong> {inputError}
      </div>
    );
  }

  // header line + KPI cards + lamps once numbers have arrived
  let header = null;
  let kpis = null;
  let lamps = <PlaceholderCard title="Bottleneck status" text="Waiting for the backend." />;
  if (estimate) {
    header = (
      <div className="estimate-header">
        <span>
          Estimated on FPGA {designLabel(estimate.design, estimate.P, estimate.bits).toLowerCase()}
        </span>
        <span className="estimate-meta mono">
          {estimate.f_mhz} MHz ({estimate.f_mhz_source}) · {estimate.bw_gbs.toFixed(2)} GB/s · util{" "}
          {estimate.util}
        </span>
        <span className="estimate-note">
          Modelled with the hardware team's performance model, not measured times.
        </span>
      </div>
    );
    kpis = <KpiCards estimate={estimate} sweep={sweep} />;
    lamps = <BottleneckLamps estimate={estimate} />;
  }

  return (
    <div className="app">
      <StatusBar config={config} flags={flags} online={online} design={design} P={P} bits={bits} />

      <div className="layout">
        {sidebar}

        <main className="main">
          {offlineMessage}
          {errorMessage}
          {header}
          {kpis}

          <div className="card-grid">
            <PlaceholderCard
              title="Tradeoff: TTFT vs tokens/s"
              text="All 9 designs, with the current one highlighted."
            />
            <PlaceholderCard
              title="Bandwidth curve"
              text="Tokens/s vs memory bandwidth for each bit width."
            />
            <PlaceholderCard
              title="Phase breakdown"
              text="Time for vision, prefill and decode, and what limits each one."
            />
            <PlaceholderCard
              title="FPGA resources"
              text="LUT, DSP, FF and BRAM use vs the Zynq-7020 limits (waiting on the Vivado sweep)."
            />
            {lamps}
            <PlaceholderCard
              title="Accuracy vs bits"
              text="Answer quality at 16, 8 and 4 bits (waiting on the model team)."
            />
            <PlaceholderCard
              title="Ask the model"
              text="Upload an image, ask a question, see the answer."
              wide={true}
            />
            <PlaceholderCard
              title="From the hardware team"
              text="The tradeoff and dataflow figures from docs/."
              wide={true}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
