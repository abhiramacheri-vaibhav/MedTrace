// Pip, the MedTrace guide: a two-tone capsule whose face matches the moment.
// Moods: happy (default), party (success), wait (saving, in transit), worried (errors, do not use),
// think (not found, no role), sleep (empty lists).
const INK = "#1E1B3A";
const BADGES = {
  party: { glyph: "celebration", bg: "#FFD84D" }, wait: { glyph: "schedule", bg: "#FFB020" },
  worried: { glyph: "priority_high", bg: "#FF8A80" }, think: { glyph: "question_mark", bg: "#FFFFFF" }, sleep: { glyph: "bedtime", bg: "#C9D7FF" },
};

export default function Pip({ mood = "happy", size = 120, color = "#5B4CF5", bob = true, badge = true }) {
  const S = size, W = Math.round(S * 0.62), bw = Math.max(2, Math.round(S * 0.028));
  const es = Math.max(4, Math.round(S * 0.075));
  const lookX = mood === "wait" ? Math.round(S * 0.025) : 0;
  const lookY = mood === "think" ? -Math.round(S * 0.02) : 0;
  const et = Math.round(S * 0.6) + lookY;
  const eyeAt = [Math.round(W * 0.3) + lookX, Math.round(W * 0.7) + lookX];
  const eye = (l) => {
    const base = { position: "absolute", left: l, top: et, transform: "translate(-50%,-50%)", boxSizing: "border-box" };
    if (mood === "party") return { ...base, width: Math.round(es * 1.6), height: Math.round(es * 0.9), border: `${bw}px solid ${INK}`, borderBottomColor: "transparent", borderRadius: `${es * 2}px ${es * 2}px 0 0` };
    if (mood === "sleep") return { ...base, width: Math.round(es * 1.5), height: bw, background: INK, borderRadius: bw };
    return { ...base, width: es, height: Math.round(es * 1.15), background: INK, borderRadius: "50%" };
  };
  const brows = mood === "worried" ? [[eyeAt[0], -18], [eyeAt[1], 18]] : mood === "think" ? [[eyeAt[1], -12]] : [];
  const mw = Math.round(S * 0.18), mt = Math.round(S * 0.73);
  const kind = { happy: "smile", party: "open", wait: "flat", worried: "frown", think: "o", sleep: "o" }[mood] || "smile";
  const mouth = {
    smile: { top: mt, width: mw, height: Math.round(S * 0.09), border: `${bw}px solid ${INK}`, borderTopColor: "transparent", borderRadius: `0 0 ${mw}px ${mw}px` },
    open: { top: mt + 2, width: mw, height: Math.round(S * 0.11), background: INK, borderRadius: `0 0 ${mw}px ${mw}px` },
    frown: { top: mt + 4, width: Math.round(mw * 0.8), height: Math.round(S * 0.07), border: `${bw}px solid ${INK}`, borderBottomColor: "transparent", borderRadius: `${mw}px ${mw}px 0 0` },
    flat: { top: mt, width: Math.round(mw * 0.7), height: bw, background: INK, borderRadius: bw },
    o: { top: mt, width: Math.round(S * 0.07), height: Math.round(S * 0.08), background: INK, borderRadius: "50%" },
  }[kind];
  const B = badge && S >= 56 ? BADGES[mood] : null;
  const bs = Math.round(S * 0.3);
  const cheeks = mood === "happy" || mood === "party";
  return (
    <div className={`pip ${bob ? "bob" : ""}`} style={{ position: "relative", width: W, height: S, flexShrink: 0 }} aria-hidden="true">
      <div style={{ position: "absolute", inset: 0, borderRadius: W, border: `${bw}px solid ${INK}`, overflow: "hidden", background: "#fff", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "50%", background: color, borderBottom: `${bw}px solid ${INK}` }} />
        <div style={{ position: "absolute", left: "18%", top: "9%", width: "16%", height: "22%", borderRadius: 999, background: "rgba(255,255,255,0.45)" }} />
      </div>
      <div style={eye(eyeAt[0])} />
      <div style={eye(eyeAt[1])} />
      {brows.map(([l, rot], i) => (
        <div key={i} style={{ position: "absolute", left: l, top: et - es * 1.4, width: es * 1.6, height: bw, borderRadius: bw, background: INK, transform: `translate(-50%,-50%) rotate(${rot}deg)` }} />
      ))}
      {cheeks ? [0.17, 0.83].map((x) => (
        <div key={x} style={{ position: "absolute", left: Math.round(W * x), top: Math.round(S * 0.68), width: Math.round(S * 0.09), height: Math.round(S * 0.055), borderRadius: "50%", background: "#FF9EC0", transform: "translate(-50%,-50%)" }} />
      )) : null}
      <div style={{ position: "absolute", left: "50%", transform: "translate(-50%,-50%)", boxSizing: "border-box", overflow: "hidden", ...mouth }}>
        {kind === "open" ? <div style={{ position: "absolute", left: "20%", right: "20%", bottom: 0, height: "45%", borderRadius: "50% 50% 0 0", background: "#FF6FA8" }} /> : null}
      </div>
      {B ? (
        <div className="pip-badge" style={{ position: "absolute", right: -Math.round(bs * 0.45), top: -Math.round(bs * 0.15), width: bs, height: bs, borderRadius: "50%", background: B.bg, border: `${bw}px solid ${INK}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", color: INK }}>
          <span className="ic fill" style={{ fontSize: Math.round(bs * 0.6) }}>{B.glyph}</span>
        </div>
      ) : null}
    </div>
  );
}
