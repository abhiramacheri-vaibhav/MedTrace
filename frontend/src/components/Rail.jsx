// A sideways-scrolling row of batch cards with arrow buttons when it overflows.
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

export default function Rail({ title, count, children, empty }) {
  const ref = useRef(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 4);
    // Newest cards go first, so jump back to the start whenever the set changes.
    el.scrollTo({ left: 0 });
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);
  const by = (d) => ref.current?.scrollBy({ left: d * 394, behavior: "smooth" });
  return (
    <section className="rail-wrap">
      <div className="rail-head">
        <div className="row" style={{ gap: 10 }}>
          <h2 className="h-sec">{title}</h2>
          <span className="count">{count}</span>
          {overflow ? <span className="swipe"><Icon name="swipe" />Swipe for more</span> : null}
        </div>
        {overflow ? (
          <div className="row" style={{ gap: 10 }}>
            <button className="round" onClick={() => by(-1)} aria-label="Scroll left"><Icon name="chevron_left" /></button>
            <button className="round" onClick={() => by(1)} aria-label="Scroll right"><Icon name="chevron_right" /></button>
          </div>
        ) : null}
      </div>
      {count ? <div ref={ref} className="rail">{children}</div> : empty}
    </section>
  );
}
