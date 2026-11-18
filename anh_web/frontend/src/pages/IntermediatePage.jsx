import PageIntro from "../components/PageIntro.jsx";
import HeroAnswer from "../components/HeroAnswer.jsx";
import KpiCards from "../components/KpiCards.jsx";
import TaskPanel from "../components/TaskPanel.jsx";
import ChartTabs from "../components/ChartTabs.jsx";
import TradeoffChart from "../components/TradeoffChart.jsx";
import PhaseBreakdown from "../components/PhaseBreakdown.jsx";
import BandwidthChart from "../components/BandwidthChart.jsx";
import ResourcesCard from "../components/ResourcesCard.jsx";
import BottleneckLamps from "../components/BottleneckLamps.jsx";
import AskPanel from "../components/AskPanel.jsx";
import PlaceholderCard from "../components/PlaceholderCard.jsx";

// Intermediate level (Apply · Analyze): the design explorer.
// Order on the page: one plain answer -> 4 numbers -> one chart at a time + tasks -> try the real model.
export default function IntermediatePage(props) {
  const estimate = props.estimate;
  const sweep = props.sweep;

  // shown only once eryc_model/accuracy.json exists (no "coming next" cards on the page)
  let accuracyCard = null;
  if (props.flags && props.flags.accuracy_pending === false) {
    accuracyCard = (
      <PlaceholderCard
        title="Accuracy vs bits"
        text="accuracy.json found: answer quality at 16, 8 and 4 bits (chart next)."
      />
    );
  }

  let body = <p className="muted-text">Waiting for the backend…</p>;
  if (estimate && sweep) {
    const tabs = [
      {
        key: "tradeoff",
        label: "Tradeoff",
        icon: "scatter",
        content: <TradeoffChart sweep={sweep} P={props.P} bits={props.bits} onSelect={props.onSelect} />,
      },
      {
        key: "time",
        label: "Where time goes",
        icon: "barChart",
        content: (
          <PhaseBreakdown sweep={sweep} estimate={estimate} P={props.P} bits={props.bits} onSelect={props.onSelect} />
        ),
      },
      {
        key: "bandwidth",
        label: "Bandwidth",
        icon: "lineChart",
        content: (
          <BandwidthChart
            curve={props.curve && props.curve.P === props.P ? props.curve : null}
            estimate={estimate}
            P={props.P}
            bits={props.bits}
            bwGbs={props.bwGbs}
          />
        ),
      },
      {
        key: "fpga",
        label: "FPGA",
        icon: "cpu",
        content: <ResourcesCard estimate={estimate} sweep={sweep} limits={props.config.chip_limits} />,
      },
      {
        key: "bottlenecks",
        label: "Bottlenecks",
        icon: "target",
        content: <BottleneckLamps estimate={estimate} />,
      },
    ];

    body = (
      <>
        <HeroAnswer estimate={estimate} sweep={sweep} />
        <KpiCards estimate={estimate} sweep={sweep} />
        <div className="explore-grid">
          <ChartTabs tabs={tabs} />
          <TaskPanel estimate={estimate} sweep={sweep} />
        </div>
        <div className="card-grid">
          <AskPanel estimate={estimate} flags={props.flags} />
          {accuracyCard}
        </div>
      </>
    );
  }

  return (
    <>
      <PageIntro page="intermediate" />
      {body}
    </>
  );
}
