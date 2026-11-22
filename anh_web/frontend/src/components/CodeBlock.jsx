import { highlightLine } from "../highlight.js";

// Read-only code with line numbers and simple colouring (same look as the Code page).
export default function CodeBlock(props) {
  const lines = props.text.replace(/\n$/, "").split("\n");
  const state = { inDocstring: false };
  let rendered = [];
  for (let i = 0; i < lines.length; i++) {
    rendered.push(
      <div className="code-line" key={i}>
        <span className="line-no">{i + 1}</span>
        <span className="line-text">{highlightLine(lines[i], props.language, state)}</span>
      </div>
    );
  }
  return <pre className="code-block mono">{rendered}</pre>;
}
