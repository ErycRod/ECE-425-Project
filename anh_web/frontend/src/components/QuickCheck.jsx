import { useState } from "react";
import Icon from "./Icon.jsx";

// One multiple-choice question with instant feedback.
// options: [{ text, correct, why }]; onCorrect is called the first time it's answered right.
export default function QuickCheck(props) {
  const [picked, setPicked] = useState(null);

  function choose(index) {
    setPicked(index);
    if (props.options[index].correct && props.onCorrect) {
      props.onCorrect();
    }
  }

  let buttons = [];
  for (let i = 0; i < props.options.length; i++) {
    const option = props.options[i];
    let className = "check-option";
    if (picked === i) {
      className = className + (option.correct ? " check-right" : " check-wrong");
    }
    buttons.push(
      <button key={i} type="button" className={className} onClick={() => choose(i)}>
        <span className="check-letter mono">{String.fromCharCode(65 + i)}</span>
        <span>{option.text}</span>
      </button>
    );
  }

  let feedback = null;
  if (picked !== null) {
    const option = props.options[picked];
    feedback = (
      <p className={option.correct ? "check-feedback check-feedback-right" : "check-feedback check-feedback-wrong"}>
        <Icon name={option.correct ? "check" : "alert"} size={14} />
        <span>
          <strong>{option.correct ? "Right. " : "Not quite. "}</strong>
          {option.why}
        </span>
      </p>
    );
  }

  return (
    <div className="quick-check">
      <p className="check-question">
        {props.label ? <span className="check-label">{props.label}</span> : null}
        {props.question}
      </p>
      <div className="check-options">{buttons}</div>
      {feedback}
    </div>
  );
}
