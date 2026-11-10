// Modal dialog: scrim fades 200 ms, panel fades + rises 300 ms. Escape closes.
import { useEffect } from "react";

export default function Dialog({ open, onClose, eyebrow, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`dialog ${wide ? "w680" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div>
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h2>{title}</h2>
        </div>
        {children}
        {footer ? <div className="foot">{footer}</div> : null}
      </div>
    </div>
  );
}
