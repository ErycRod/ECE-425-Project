import Icon from "../components/Icon.jsx";
import PipelineStrip from "../components/PipelineStrip.jsx";
import FiguresCard from "../components/FiguresCard.jsx";
import { PAGES } from "../levels.js";
import { findDesign, humanDuration } from "../format.js";

const WHY_EDGE = [
  { icon: "eye", title: "Private", text: "The photo never leaves the device." },
  { icon: "sparkle", title: "Works offline", text: "No internet or cloud server needed." },
  { icon: "zap", title: "Low power", text: "Our FPGA designs use well under 1 W (Vivado estimates)." },
];

const PERSONAS = [
  {
    icon: "cpu",
    title: "ECE students",
    text: "You know some digital logic and want to see how hardware choices decide how fast an AI model runs.",
  },
  {
    icon: "layers",
    title: "Deep learning students",
    text: "You know what a model is and want to know why it is slow on a small device, and what fixes it.",
  },
  {
    icon: "target",
    title: "Edge AI builders",
    text: "You're choosing hardware for a camera, robot or wearable and need to compare designs quickly.",
  },
];

const PREREQS = [
  { name: "Matrix multiply", text: "Rows times columns. The Beginner level shows it step by step." },
  { name: "Clock speed (MHz)", text: "How many times per second the chip does one step of work." },
  { name: "Bits and bytes", text: "A 16-bit number is 2 bytes; a 4-bit number is half a byte." },
];

// Landing page: what the tool is, why it matters, who it's for, and where to start.
export default function HomePage(props) {
  const start = findDesign(props.sweep, 4, 16);

  let hook = null;
  if (start) {
    hook = (
      <p className="home-hook">
        On the smallest design we built, answering one question about a photo takes{" "}
        <strong>{humanDuration(start.answer_s)}</strong>. Our best design does it in{" "}
        <strong>{humanDuration(bestAnswer(props.sweep))}</strong>. This tool shows you why.
      </p>
    );
  }

  let levelCards = [];
  for (let i = 1; i < PAGES.length; i++) {
    const page = PAGES[i];
    levelCards.push(
      <a key={page.key} className="level-card" href={"#/" + page.key}>
        <span className="level-card-top">
          <Icon name={page.icon} size={18} />
          <span className="level-card-name">{page.name}</span>
        </span>
        <span className="bloom-tag">{page.bloom}</span>
        <span className="level-card-goal">{page.goal}</span>
        <span className="level-card-go">
          Open <span aria-hidden="true">→</span>
        </span>
      </a>
    );
  }

  return (
    <div className="home">
      <section className="home-hero">
        <p className="eyebrow">ECE 425/525 · Interactive Deep Learning Toolkit</p>
        <h1>Why does an AI on a small chip take minutes to answer?</h1>
        <p className="home-lead">
          EdgeVLM Lab lets you design a small FPGA accelerator for a real vision-language model
          (SmolVLM-256M) and see right away how the array size, the number of bits per weight and the
          memory speed change how long you wait for an answer.
        </p>
        {hook}
        <div className="home-buttons">
          <a className="button-primary" href="#/beginner">
            <Icon name="book" size={16} /> Start learning
          </a>
          <a className="button-secondary" href="#/intermediate">
            <Icon name="gauge" size={16} /> Jump to the explorer
          </a>
        </div>
      </section>

      <section className="home-section">
        <h2 className="section-title">What happens when you ask the model about a photo</h2>
        <PipelineStrip design={start} />
        <p className="section-note">
          Times shown are for the starting design (4×4 array, 16-bit
          {start ? ", " + start.bw_gbs.toFixed(2) + " GB/s" : ""}). “Math-limited” steps
          get faster with a bigger array; “memory-limited” steps get faster with fewer bits or more
          bandwidth.
        </p>
      </section>

      <section className="home-section">
        <h2 className="section-title">Why run it on the device (the “edge”)?</h2>
        <div className="tile-row">
          {WHY_EDGE.map((item) => (
            <div className="tile" key={item.title}>
              <Icon name={item.icon} size={20} />
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
        <p className="section-note">
          The catch: a small chip has few multipliers and slow memory, so waiting time becomes the
          problem. The <strong>time to first token</strong> (how long until the first word appears)
          is what users notice most.
        </p>
      </section>

      <section className="home-section">
        <h2 className="section-title">Choose your level</h2>
        <div className="level-cards">{levelCards}</div>
      </section>

      <section className="home-section home-two">
        <div>
          <h2 className="section-title">Who it's for</h2>
          <div className="persona-list">
            {PERSONAS.map((item) => (
              <div className="persona" key={item.title}>
                <span className="persona-icon">
                  <Icon name={item.icon} size={18} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="section-title">Good to know first</h2>
          <ul className="prereq-list">
            {PREREQS.map((item) => (
              <li key={item.name}>
                <Icon name="check" size={14} />
                <span>
                  <strong>{item.name}:</strong> {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FiguresCard figures={props.config ? props.config.figures : null} />
    </div>
  );
}

// fastest whole answer among the 9 designs
function bestAnswer(sweep) {
  let best = null;
  for (let i = 0; i < sweep.designs.length; i++) {
    const value = sweep.designs[i].answer_s;
    if (best === null || value < best) {
      best = value;
    }
  }
  return best;
}
