import Icon from "../components/Icon.jsx";
import PageIntro from "../components/PageIntro.jsx";

const COMING = [
  {
    icon: "cpu",
    bloom: "Create",
    title: "Build your accelerator",
    text: "Pick the array size, bits, clock and memory bandwidth for your own design.",
  },
  {
    icon: "code",
    bloom: "Create",
    title: "Get its Verilog",
    text: "The tool writes the top-level module and testbench command for your design, ready for Vivado.",
  },
  {
    icon: "scatter",
    bloom: "Evaluate",
    title: "Rank it against the 9 real designs",
    text: "See where it lands on the tradeoff chart and a plain explanation of why it wins or loses.",
  },
  {
    icon: "target",
    bloom: "Evaluate",
    title: "Challenges",
    text: "For example: the fastest answer that fits the chip, or the lowest energy under a 1-minute first word.",
  },
];

// Advanced level (Evaluate · Create). Placeholder until the design builder is in.
export default function AdvancedPage() {
  return (
    <div className="level-page">
      <PageIntro page="advanced" />
      <section className="card">
        <h2 className="card-title card-title-icon">
          <Icon name="sparkle" size={14} /> Being built now
        </h2>
        <div className="coming-grid">
          {COMING.map((item) => (
            <div className="tile" key={item.title}>
              <Icon name={item.icon} size={20} />
              <strong>{item.title}</strong>
              <span className="bloom-tag">{item.bloom}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
        <p className="section-note">
          Meanwhile, try the tasks in{" "}
          <a href="#/intermediate">Intermediate</a> or read the code behind the numbers in{" "}
          <a href="#/code">Code</a>.
        </p>
      </section>
    </div>
  );
}
