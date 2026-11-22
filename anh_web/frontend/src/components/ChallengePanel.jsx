import { useEffect } from "react";
import useStoredState from "../useStoredState.js";
import Icon from "./Icon.jsx";
import InfoTip from "./InfoTip.jsx";
import { makeChallenges, MAX_CHALLENGE_P } from "../challenges.js";

export default function ChallengePanel(props) {
  const reply = props.reply;
  const [done, setDone] = useStoredState("advanced-challenges", {});
  const challenges = makeChallenges(reply);

  // tick off challenges the current design meets (they stay ticked)
  useEffect(() => {
    let changed = false;
    const copy = { ...done };
    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      if (!copy[c.key] && c.check(reply)) {
        copy[c.key] = reply.design.P + "×" + reply.design.P + "/" + reply.design.bits + "-bit";
        changed = true;
      }
    }
    if (changed) {
      setDone(copy);
    }
  }, [reply]);

  let count = 0;
  let items = [];
  for (let i = 0; i < challenges.length; i++) {
    const c = challenges[i];
    const solved = done[c.key];
    if (solved) {
      count = count + 1;
    }
    items.push(
      <li key={c.key} className={solved ? "task task-done" : "task"}>
        <span className="task-box">{solved ? <Icon name="check" size={13} /> : null}</span>
        <div className="task-body">
          <div className="task-title">
            <span className="task-bloom">{c.bloom}</span>
            {c.title}
          </div>
          {solved ? <div className="task-solved mono">Done with {solved}</div> : null}
        </div>
        {solved ? null : (
          <InfoTip label="Hint" align="right">
            {c.hint}
          </InfoTip>
        )}
      </li>
    );
  }

  return (
    <section className="card task-panel">
      <div className="card-header">
        <h2 className="card-title card-title-icon">
          <Icon name="sparkle" size={15} /> Challenges
        </h2>
        <span className="task-count mono">
          {count} / {challenges.length}
        </span>
      </div>
      <div className="task-progress" aria-hidden="true">
        <div className="task-progress-fill" style={{ width: (count / challenges.length) * 100 + "%" }}></div>
      </div>
      <ol className="task-list">{items}</ol>
      <p className="section-note">
        Only designs up to {MAX_CHALLENGE_P}×{MAX_CHALLENGE_P} count: bigger ones are too far from anything we
        synthesized to trust the hardware numbers.
      </p>
    </section>
  );
}
