import { useEffect, useState } from "react";
import useStoredState from "../useStoredState.js";
import NextLevel from "../components/NextLevel.jsx";
import PageIntro from "../components/PageIntro.jsx";
import BuilderPanel from "../components/BuilderPanel.jsx";
import HeroAnswer from "../components/HeroAnswer.jsx";
import KpiCards from "../components/KpiCards.jsx";
import VerdictCard from "../components/VerdictCard.jsx";
import ChallengePanel from "../components/ChallengePanel.jsx";
import TradeoffChart from "../components/TradeoffChart.jsx";
import ResourcesCard from "../components/ResourcesCard.jsx";
import VerilogCard from "../components/VerilogCard.jsx";
import EstimateCheckCard from "../components/EstimateCheckCard.jsx";
import { postCustomDesign } from "../api.js";

const DEBOUNCE_MS = 200;
// Zynq-7020 limits, used until /api/config has loaded
const CHIP_LIMITS = { luts: 53200, dsps: 220, ffs: 106400, bram: 140 };

// Advanced level (Evaluate · Create): build any P x P design, see how it compares with
// the 9 synthesized designs and why, try the challenges, and take its Verilog to Vivado.
// Everything comes from one call: POST /api/custom_design.
export default function AdvancedPage(props) {
  const [P, setP] = useStoredState("advanced-P", 12);
  const [bits, setBits] = useStoredState("advanced-bits", 8);
  const [bwGbs, setBwGbs] = useStoredState("advanced-bw", 1.0);
  const [clockText, setClockText] = useState("");
  const [reply, setReply] = useState(null);
  const [error, setError] = useState(null);

  // ask the backend again (after a short pause) whenever a control changes
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const body = { P: P, bits: bits, bw_gbs: bwGbs };
      const clock = Number(clockText);
      if (clockText !== "" && clock > 0) {
        body.f_mhz = clock;
      }
      const answer = await postCustomDesign(body);
      if (cancelled) {
        return;
      }
      if (answer.ok) {
        setReply(answer.data);
        setError(null);
      } else {
        setError(answer.error);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [P, bits, bwGbs, clockText]);

  function handleChange(change) {
    if (change.P !== undefined) {
      setP(change.P);
    }
    if (change.bits !== undefined) {
      setBits(change.bits);
    }
    if (change.bwGbs !== undefined) {
      setBwGbs(change.bwGbs);
    }
    if (change.clockText !== undefined) {
      setClockText(change.clockText);
    }
  }

  let minP = 2;
  let maxP = 32;
  let estimatedClock = null;
  if (reply) {
    minP = reply.limits.min_P;
    maxP = reply.limits.max_P;
    estimatedClock = reply.design.resources.fmax_mhz;
  }

  let errorMessage = null;
  if (error) {
    errorMessage = <p className="ask-message">{error}</p>;
  }

  let results = <p className="muted-text">Building your design…</p>;
  let details = null;
  if (reply) {
    const sweep = { designs: reply.designs };
    const design = reply.design;
    results = (
      <>
        <HeroAnswer estimate={design} sweep={sweep} accuracy={props.accuracy} />
        <ChallengePanel reply={reply} />
      </>
    );
    details = (
      <>
        <KpiCards estimate={design} sweep={sweep} />
        <div className="card-grid">
          <VerdictCard ranking={reply.ranking} explanations={reply.explanations} accuracy={reply.accuracy} />
          <TradeoffChart
            sweep={sweep}
            P={P}
            bits={bits}
            onSelect={(newP, newBits) => handleChange({ P: newP, bits: newBits })}
            extra={{
              ttft_s: design.ttft_s,
              tokens_per_s: design.tokens_per_s,
              label: "Your design · " + P + "×" + P + "/" + bits + "-bit",
            }}
          />
          <ResourcesCard estimate={design} sweep={sweep} limits={props.config ? props.config.chip_limits : CHIP_LIMITS} />
          <EstimateCheckCard />
          <VerilogCard verilog={reply.verilog} commands={reply.commands} P={P} bits={bits} />
        </div>
      </>
    );
  }

  return (
    <div className="level-page">
      <PageIntro page="advanced" />
      {errorMessage}
      <div className="adv-top">
        <BuilderPanel
          P={P}
          bits={bits}
          bwGbs={bwGbs}
          clockText={clockText}
          minP={minP}
          maxP={maxP}
          estimatedClock={estimatedClock}
          onChange={handleChange}
        />
        <div className="adv-results">{results}</div>
      </div>
      {details}
      <NextLevel to="code" label="Want to see the code behind the numbers?" />
    </div>
  );
}
