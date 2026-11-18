import { useState } from "react";
import Icon from "../components/Icon.jsx";
import PageIntro from "../components/PageIntro.jsx";
import PipelineStrip from "../components/PipelineStrip.jsx";
import QuickCheck from "../components/QuickCheck.jsx";
import MatrixDemo from "../components/MatrixDemo.jsx";
import { findDesign, humanDuration } from "../format.js";

const GOALS = [
  "Name the steps a vision-language model takes to answer a question.",
  "Work out one number of a matrix multiply by hand.",
  "Describe how a systolic array does many multiply-adds at once.",
  "Tell a math-limited step from a memory-limited one, and what speeds each up.",
];

// Beginner level (Remember · Understand): five short steps, one idea each,
// each ending with a quick check.
export default function BeginnerPage(props) {
  const [step, setStep] = useState(0);
  const [passed, setPassed] = useState({});
  const start = findDesign(props.sweep, 4, 16);

  let visionShare = "about 90%";
  if (start) {
    visionShare = Math.round((start.phases.vision.time_s / start.ttft_s) * 100) + "%";
  }

  const steps = [
    {
      title: "What the model does",
      body: (
        <>
          <p>
            A <strong>vision-language model</strong> (VLM) answers questions about pictures. We use
            SmolVLM-256M, a small open model that could fit on a device like a camera or a phone. It
            works in four steps:
          </p>
          <PipelineStrip design={start} />
          <p>
            On the starting design the vision encoder is <strong>{visionShare}</strong> of the wait for
            the first word.
          </p>
        </>
      ),
      check: {
        question: "Which step looks at the picture?",
        options: [
          { text: "Vision encoder", correct: true, why: "It turns image tiles into tokens the language model can read." },
          { text: "LM prefill", correct: false, why: "Prefill reads the tokens the vision encoder made; it never sees pixels." },
          { text: "Decode", correct: false, why: "Decode writes the answer word by word." },
        ],
      },
    },
    {
      title: "Everything is multiply-add",
      body: (
        <>
          <p>
            Almost all of the model's work is <strong>matrix multiplication</strong>: each output
            number is a row of one matrix times a column of another, added up.
          </p>
          <MatrixDemo />
        </>
      ),
      check: {
        question: "To get one number of C when multiplying two 3×3 matrices, how many multiplies do you do?",
        options: [
          { text: "1", correct: false, why: "One output uses a whole row of A and a whole column of B." },
          { text: "3", correct: true, why: "One for each pair in the row and column, then add them up." },
          { text: "9", correct: false, why: "9 is how many output numbers C has, not the work for one of them." },
        ],
      },
    },
    {
      title: "The systolic array",
      body: (
        <>
          <p>
            Our accelerator is a <strong>systolic array</strong>: a P×P grid of small units called
            processing elements (PEs). Every clock cycle, each PE multiplies two numbers, adds the
            result to its running total, and passes the numbers on to its neighbours.
          </p>
          <ul className="plain-list">
            <li>
              <Icon name="grid" size={14} /> Numbers from A flow <strong>right</strong>, numbers from B
              flow <strong>down</strong>.
            </li>
            <li>
              <Icon name="target" size={14} /> They meet in the PE that owns that output, so each PE
              builds one number of C.
            </li>
            <li>
              <Icon name="zap" size={14} /> A P×P array does <strong>P² multiply-adds per cycle</strong>:
              16 for 4×4, 256 for 16×16.
            </li>
          </ul>
          <figure className="figure">
            <img className="figure-img figure-small" src="/api/figures/dataflow" alt="Data flowing through a systolic array: A moves right, B moves down." />
            <figcaption className="figure-caption">A step-by-step animation of this is coming next.</figcaption>
          </figure>
        </>
      ),
      check: {
        question: "How many multiply-adds does an 8×8 array do in one clock cycle?",
        options: [
          { text: "8", correct: false, why: "That's one row. Every PE in the grid works at the same time." },
          { text: "16", correct: false, why: "That's 8 + 8. Count the PEs: 8 rows of 8." },
          { text: "64", correct: true, why: "8 × 8 = 64 PEs, each doing one multiply-add per cycle." },
        ],
      },
    },
    {
      title: "Math-limited or memory-limited?",
      body: (
        <>
          <p>Each step is held back by one of two things. Think of a kitchen:</p>
          <div className="tile-row">
            <div className="tile tile-compute">
              <Icon name="cpu" size={20} />
              <strong>Math-limited (compute-bound)</strong>
              <span>
                Not enough cooks. The vision encoder and prefill do lots of math with each weight.
                <em> Fix: a bigger array.</em>
              </span>
            </div>
            <div className="tile tile-memory">
              <Icon name="memory" size={20} />
              <strong>Memory-limited (memory-bound)</strong>
              <span>
                The delivery truck is too slow. Decode re-reads all 135 million weights for each word
                but does little math with them. <em>Fix: fewer bits per weight, or more bandwidth.</em>
              </span>
            </div>
          </div>
          {start ? (
            <p>
              On the starting design, decode takes <strong>{humanDuration(start.phases.decode.time_s)}</strong>{" "}
              per word, so it writes about {start.tokens_per_s.toFixed(1)} words per second.
            </p>
          ) : null}
        </>
      ),
      check: {
        question: "Decode re-reads every weight for each word. What makes it faster?",
        options: [
          { text: "A bigger array", correct: false, why: "More cooks don't help if they're waiting for the delivery truck." },
          { text: "Fewer bits per weight", correct: true, why: "Fewer bytes to read for each word, so the memory finishes sooner." },
          { text: "A longer question", correct: false, why: "That adds prefill work and doesn't change decode." },
        ],
      },
    },
    {
      title: "Ready to explore",
      body: (
        <>
          <p>You now know the four ideas behind every number in this tool:</p>
          <ul className="plain-list">
            <li><Icon name="check" size={14} /> The four steps: vision encoder, prefill, decode, answer.</li>
            <li><Icon name="check" size={14} /> All of it is multiply-adds.</li>
            <li><Icon name="check" size={14} /> A P×P systolic array does P² of them per cycle.</li>
            <li><Icon name="check" size={14} /> Bigger array → faster math; fewer bits → faster memory.</li>
          </ul>
          <p>In the Intermediate level you'll change the design yourself and complete tasks.</p>
          <a className="button-primary" href="#/intermediate">
            <Icon name="gauge" size={16} /> Go to Intermediate
          </a>
        </>
      ),
      check: null,
    },
  ];

  const current = steps[step];

  let stepList = [];
  for (let i = 0; i < steps.length; i++) {
    let className = "step-link";
    if (i === step) {
      className = className + " step-link-on";
    }
    stepList.push(
      <li key={i}>
        <button type="button" className={className} onClick={() => setStep(i)}>
          <span className={passed[i] ? "step-num step-num-done" : "step-num"}>
            {passed[i] ? <Icon name="check" size={12} /> : i + 1}
          </span>
          {steps[i].title}
        </button>
      </li>
    );
  }

  let check = null;
  if (current.check) {
    check = (
      <QuickCheck
        key={step}
        label="Quick check"
        question={current.check.question}
        options={current.check.options}
        onCorrect={() => {
          const copy = { ...passed };
          copy[step] = true;
          setPassed(copy);
        }}
      />
    );
  }

  return (
    <div className="level-page">
      <PageIntro page="beginner" />
      <div className="goals card">
        <h2 className="card-title card-title-icon">
          <Icon name="target" size={14} /> By the end you can
        </h2>
        <ol className="goal-list">
          {GOALS.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ol>
      </div>

      <div className="stepper">
        <ol className="step-list">{stepList}</ol>
        <section className="card step-card">
          <p className="step-count mono">
            Step {step + 1} of {steps.length}
          </p>
          <h2 className="step-title">{current.title}</h2>
          <div className="step-body">{current.body}</div>
          {check}
          <div className="step-nav">
            <button type="button" className="button-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
              ← Back
            </button>
            {step < steps.length - 1 ? (
              <button type="button" className="button-primary" onClick={() => setStep(step + 1)}>
                Next →
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
