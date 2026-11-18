import PageIntro from "../components/PageIntro.jsx";
import DevView from "../components/DevView.jsx";

// Code page: the developer view (roofline math, Verilog, Python, raw API JSON)
// for whatever design the sidebar has selected.
export default function CodePage(props) {
  return (
    <>
      <PageIntro page="code" />
      <DevView estimate={props.estimate} request={props.request} />
    </>
  );
}
