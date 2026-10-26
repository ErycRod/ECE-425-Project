// Empty card that holds a spot in the layout until that part is built.
export default function PlaceholderCard(props) {
  let className = "card placeholder-card";
  if (props.wide) {
    className = className + " span-2";
  }

  return (
    <section className={className}>
      <div className="card-header">
        <h2 className="card-title">{props.title}</h2>
      </div>
      <div className="placeholder-body">
        <span className="placeholder-tag">COMING NEXT</span>
        <p>{props.text}</p>
      </div>
    </section>
  );
}
