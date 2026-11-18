import { useEffect, useRef, useState } from "react";
import { getConfig, getEstimate, getSweep, getBandwidthCurve } from "./api.js";
import { usePage } from "./levels.js";
import StatusBar from "./components/StatusBar.jsx";
import OperatorPanel from "./components/OperatorPanel.jsx";
import HomePage from "./pages/HomePage.jsx";
import BeginnerPage from "./pages/BeginnerPage.jsx";
import IntermediatePage from "./pages/IntermediatePage.jsx";
import AdvancedPage from "./pages/AdvancedPage.jsx";
import CodePage from "./pages/CodePage.jsx";

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
  const [curve, setCurve] = useState(null);

  // which page is showing (Home, Beginner, Intermediate, Advanced, Code)
  const [page] = usePage();

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

  // bandwidth curve for the current array size (changes with P and the advanced settings)
  useEffect(() => {
    if (config === null) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const settings = buildSettings(bwGbs, advanced);
      delete settings.bw_gbs; // the curve covers every bandwidth
      const reply = await getBandwidthCurve({ ...settings, P: P, points: 76 });
      if (!cancelled && reply.ok) {
        setCurve(reply.data);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // bwGbs is left out on purpose: the curve doesn't depend on it
  }, [config, P, advanced, retryTick]);

  // clicking a design in a chart selects it in the sidebar
  function selectDesign(newP, newBits) {
    setP(newP);
    setBits(newBits);
  }

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
        sweep={sweep}
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

  // the page itself
  let content;
  let withSidebar = false;
  if (page === "beginner") {
    content = <BeginnerPage sweep={sweep} />;
  } else if (page === "intermediate") {
    withSidebar = true;
    content = (
      <IntermediatePage
        config={config}
        estimate={estimate}
        sweep={sweep}
        curve={curve}
        flags={flags}
        P={P}
        bits={bits}
        bwGbs={bwGbs}
        onSelect={selectDesign}
      />
    );
  } else if (page === "advanced") {
    content = <AdvancedPage />;
  } else if (page === "code") {
    withSidebar = true;
    content = <CodePage estimate={estimate} request={{ ...buildSettings(bwGbs, advanced), P: P, bits: bits }} />;
  } else {
    content = <HomePage sweep={sweep} config={config} />;
  }

  let body;
  if (withSidebar) {
    body = (
      <div className="layout">
        {sidebar}
        <main className="main">
          {offlineMessage}
          {errorMessage}
          {content}
        </main>
      </div>
    );
  } else {
    body = (
      <main className="main page-wide">
        {offlineMessage}
        {content}
      </main>
    );
  }

  return (
    <div className="app">
      <StatusBar config={config} flags={flags} online={online} page={page} />
      {body}
    </div>
  );
}
