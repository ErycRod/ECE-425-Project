// Small amber pill shown on cards that use placeholder data.
// It only shows when the backend's flags say so, so it goes away by itself
// once the real files arrive.
export default function Badge(props) {
  if (!props.show) {
    return null;
  }

  let text = "PLACEHOLDER DATA";
  if (props.text) {
    text = props.text;
  }

  return (
    <span className="badge" title={props.title}>
      {text}
    </span>
  );
}
