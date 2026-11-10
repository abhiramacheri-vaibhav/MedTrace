import Icon from "./Icon.jsx";

export default function Empty({ icon = "inbox", title, text, big = false }) {
  return (
    <div className={`empty ${big ? "big" : ""}`}>
      <div className="glyph round neutral sm"><Icon name={icon} /></div>
      <div><div className="t">{title}</div><div className="s">{text}</div></div>
    </div>
  );
}
