// Empty states: Pip plus one line saying what happens next.
import Icon from "./Icon.jsx";
import Pip from "./Pip.jsx";

export default function Empty({ mood = "sleep", color = "#FF8A3D", title, text, big = false, arrow }) {
  return (
    <div className={`empty ${big ? "big" : ""}`}>
      <Pip size={big ? 140 : 80} mood={mood} color={color} />
      <div>
        <div className="t">{title}</div>
        <div className="s" style={big ? { justifyContent: "center" } : undefined}>{arrow ? <Icon name={arrow} /> : null}{text}</div>
      </div>
    </div>
  );
}
