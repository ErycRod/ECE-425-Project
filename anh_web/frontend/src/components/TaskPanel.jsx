import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import InfoTip from "./InfoTip.jsx";
import QuickCheck from "./QuickCheck.jsx";
import { findDesign, shortDesignName } from "../format.js";

// Tasks for the Intermediate level. The first four tick themselves off when
// the current estimate meets the goal; the last one is a question.
export const TASKS = [
  {
    key: "fast-first-word",
    bloom: "Apply",
    title: "Get the first word in under 1 minute.",
    hint: "The first word waits on the vision encoder's huge matrix multiplies. What lets the chip do more of them at once?",
    check: (e) => e.ttft_s < 60,
  },
  {
    key: "fast-talker",
    bloom: "Apply",
    title: "Keep 16-bit weights and make it write faster than 10 words per second.",
    hint: "Every new word re-reads every weight from memory. If you can't make the weights smaller, how else can you move them faster?",
    check: (e) => e.bits === 16 && e.tokens_per_s > 10,
  },
  {
    key: "decode-compute",
    bloom: "Analyze",
    title: "Find a setting where decode becomes math-limited instead of memory-limited.",
    hint: "Decode normally waits on memory. Give it lots of bandwidth with a small array, then look at the Bottlenecks tab.",
    check: (e) => e.phases.decode.bound === "compute",
  },
  {
    key: "low-energy",
    bloom: "Analyze",
    title: "With an 8×8 array, answer a question using less than 20 J of energy.",
    hint: "Energy = power × time. Try all three bit widths at 8×8 and compare the clock and power in the FPGA tab. The answer may surprise you.",
    check: (e) => e.P === 8 && typeof e.energy_J === "number" && e.energy_J < 20,
  },
];

// the "why is 8-bit slower?" question, with the clock numbers from the sweep
function whyQuestion(sweep) {
  let fast = "about 296";
  let slow = "about 130";
  const d16 = findDesign(sweep, 4, 16);
  const d8 = findDesign(sweep, 4, 8);
  if (d16 && d8) {
    fast = String(Math.round(d16.f_mhz));
    slow = String(Math.round(d8.f_mhz));
  }
  return {
    question:
      "At 4×4, the 8-bit design takes longer to give the first word than the 16-bit design, even though its weights are half the size. Why?",
    options: [
      {
        text: "8-bit weights need more memory traffic.",
        correct: false,
        why: "8-bit weights are half the bytes of 16-bit ones, so they need less memory traffic, not more.",
      },
      {
        text: "Vivado builds 8-bit multipliers from LUTs instead of DSP blocks, so the clock drops from " +
          fast + " to " + slow + " MHz.",
        correct: true,
        why: "The first word is math-limited, so the clock speed matters more than the number of bytes. Both designs have the same 16 multipliers.",
      },
      {
        text: "The 8-bit design has fewer multipliers.",
        correct: false,
        why: "Both are 4×4 arrays with 16 multipliers. Compare their clock speeds in the FPGA tab.",
      },
      {
        text: "8-bit models need to read more tokens.",
        correct: false,
        why: "The workload (877 prompt tokens, 32 answer words) is the same for every design.",
      },
    ],
  };
}

export default function TaskPanel(props) {
  const e = props.estimate;
  // key -> name of the design that solved it, e.g. "16×16/4-bit"
  const [done, setDone] = useState({});

  // tick off any task the current numbers meet
  useEffect(() => {
    if (!e) {
      return;
    }
    let changed = false;
    const copy = { ...done };
    for (let i = 0; i < TASKS.length; i++) {
      const task = TASKS[i];
      if (!copy[task.key] && task.check(e)) {
        copy[task.key] = shortDesignName(e.P, e.bits) + " at " + e.bw_gbs.toFixed(2) + " GB/s";
        changed = true;
      }
    }
    if (changed) {
      setDone(copy);
    }
    // only re-check when the numbers change
    // (done is read but not a trigger, so ticking one off doesn't loop)
  }, [e]);

  let count = 0;
  let items = [];
  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i];
    const solved = done[task.key];
    if (solved) {
      count = count + 1;
    }
    items.push(
      <li key={task.key} className={solved ? "task task-done" : "task"}>
        <span className="task-box">{solved ? <Icon name="check" size={13} /> : null}</span>
        <div className="task-body">
          <div className="task-title">
            <span className="task-bloom">{task.bloom}</span>
            {task.title}
          </div>
          {solved ? <div className="task-solved mono">Done with {solved}</div> : null}
        </div>
        {solved ? null : (
          <InfoTip label="Hint" align="right">
            {task.hint}
          </InfoTip>
        )}
      </li>
    );
  }

  const question = whyQuestion(props.sweep);
  if (done.why) {
    count = count + 1;
  }
  const total = TASKS.length + 1;

  function markWhyDone() {
    const copy = { ...done };
    copy.why = "answer";
    setDone(copy);
  }

  return (
    <section className="card task-panel">
      <div className="card-header">
        <h2 className="card-title card-title-icon">
          <Icon name="target" size={15} /> Tasks
        </h2>
        <span className="task-count mono">
          {count} / {total}
        </span>
      </div>
      <div className="task-progress" aria-hidden="true">
        <div className="task-progress-fill" style={{ width: (count / total) * 100 + "%" }}></div>
      </div>
      <ol className="task-list">{items}</ol>
      <QuickCheck label="Analyze" question={question.question} options={question.options} onCorrect={markWhyDone} />
      {count > 0 ? (
        <button className="chip-button task-reset" type="button" onClick={() => setDone({})}>
          Start over
        </button>
      ) : null}
    </section>
  );
}
