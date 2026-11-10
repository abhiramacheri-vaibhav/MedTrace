// Page header: Pip in the role's colour, a greeting, and a few count tiles.
import Icon from "./Icon.jsx";
import Pip from "./Pip.jsx";

export default function PageHero({ color, mood = "happy", title, sub, stats = [], right }) {
  return (
    <div className="hero">
      <div className="row" style={{ gap: 18, flexWrap: "nowrap" }}>
        <Pip size={80} mood={mood} color={color} />
        <div>
          <h1 className="h-page">{title}</h1>
          {sub ? <p className="sub">{sub}</p> : null}
        </div>
      </div>
      <div className="row" style={{ gap: 14 }}>
        {right}
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <div className="tile s48 flat wig" style={{ background: s.col }}><Icon name={s.icon} /></div>
            <div className="stat-txt"><span className="n">{s.n}</span><span className="l">{s.label}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
