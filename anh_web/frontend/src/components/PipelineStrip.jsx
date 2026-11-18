import Icon from "./Icon.jsx";
import { humanDuration } from "../format.js";

// The path of one question through the model, left to right, with icons:
// image + question -> vision encoder -> LM prefill -> decode -> answer.
// If a design is given (a row from /api/sweep), each step also shows its time.
export default function PipelineStrip(props) {
  const d = props.design;

  let visionTime = null;
  let prefillTime = null;
  let decodeTime = null;
  let words = 32;
  if (d) {
    visionTime = humanDuration(d.phases.vision.time_s);
    prefillTime = humanDuration(d.phases.prefill.time_s);
    decodeTime = d.out_tokens + " × " + humanDuration(d.phases.decode.time_s);
    words = d.out_tokens;
  }

  const steps = [
    {
      icon: "image",
      name: "Image + question",
      text: "A photo and a question, like “What is in this picture?”",
      bound: null,
      time: null,
    },
    {
      icon: "eye",
      name: "Vision encoder",
      text: "Cuts the image into tiles and turns them into numbers (tokens).",
      bound: "compute",
      time: visionTime,
    },
    {
      icon: "layers",
      name: "LM prefill",
      text: "The language model reads all the image and question tokens at once.",
      bound: "compute",
      time: prefillTime,
    },
    {
      icon: "message",
      name: "Decode",
      text: "Writes the answer one word at a time, re-reading every weight for each word.",
      bound: "memory",
      time: decodeTime,
    },
    {
      icon: "check",
      name: "Answer",
      text: "About " + words + " words of text.",
      bound: null,
      time: null,
    },
  ];

  let items = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let bound = null;
    if (step.bound) {
      bound = (
        <span className={"pipe-bound pipe-bound-" + step.bound}>
          {step.bound === "compute" ? "math-limited" : "memory-limited"}
        </span>
      );
    }
    let time = null;
    if (step.time) {
      time = <span className="pipe-time mono">{step.time}</span>;
    }
    items.push(
      <li className="pipe-step" key={step.name}>
        <span className="pipe-icon">
          <Icon name={step.icon} size={22} />
        </span>
        <span className="pipe-name">{step.name}</span>
        {props.compact ? null : <span className="pipe-text">{step.text}</span>}
        {bound}
        {time}
      </li>
    );
  }

  return <ol className={props.compact ? "pipeline pipeline-compact" : "pipeline"}>{items}</ol>;
}
