// One short burst of confetti inside the nearest positioned parent. Only for good news, never errors.
// Skipped entirely when the viewer prefers reduced motion.
import { useMemo } from "react";

const COLS = ["#5B4CF5", "#FF6FA8", "#FFB020", "#22C08F", "#3DA5FF", "#FF8A3D"];
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Confetti({ count = 36, distance = 320, seed = 7 }) {
  const pieces = useMemo(() => {
    let s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    return Array.from({ length: count }, (_, i) => {
      const round = rnd() > 0.6;
      return { x: `${(rnd() * 100).toFixed(1)}%`, w: round ? 10 : 8 + Math.round(rnd() * 6), h: round ? 10 : 14 + Math.round(rnd() * 8), r: round ? "50%" : "3px", bg: COLS[i % COLS.length], dur: 1600 + Math.round(rnd() * 1000), delay: Math.round(rnd() * 700) };
    });
  }, [count, seed]);
  if (reduced()) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: p.x, width: p.w, height: p.h, borderRadius: p.r, background: p.bg, "--cf-d": `${distance}px`, animation: `fall ${p.dur}ms cubic-bezier(0.3,0.6,0.5,1) ${p.delay}ms 1 both` }} />
      ))}
    </div>
  );
}
