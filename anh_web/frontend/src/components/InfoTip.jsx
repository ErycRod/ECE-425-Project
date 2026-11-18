import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

// Small (i) button. Hover, focus or click it to read a short explanation.
// Keeps long paragraphs off the page: short label on the card, details here.
export default function InfoTip(props) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // close when clicking anywhere else
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleClick(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  let bubble = null;
  if (open) {
    let className = "infotip-bubble";
    if (props.align === "right") {
      className = className + " infotip-right";
    }
    bubble = (
      <span className={className} role="tooltip">
        {props.children}
      </span>
    );
  }

  return (
    <span
      className="infotip"
      ref={boxRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="infotip-button"
        type="button"
        aria-label={props.label || "More info"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Icon name="info" size={14} />
      </button>
      {bubble}
    </span>
  );
}
