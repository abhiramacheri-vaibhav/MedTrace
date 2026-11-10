// Modal dialog: scrim fades in, the card pops in with a small overshoot. Escape or a scrim click closes.
import { useEffect } from "react";

export default function Dialog({ open, onClose, title, sub, art, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        {art}
        <div>
          <h2>{title}</h2>
          {sub ? <div className="d-sub">{sub}</div> : null}
        </div>
        {children}
        {footer ? <div className="d-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
