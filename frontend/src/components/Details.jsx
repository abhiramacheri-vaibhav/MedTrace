// Collapsed "Details" row for technical values (accounts, ids, document links).
import { useState } from "react";
import Icon from "./Icon.jsx";

export default function Details({ rows, defaultOpen = false, label = "Details" }) {
  const [open, setOpen] = useState(defaultOpen);
  const visible = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
  return (
    <div>
      <button className="details-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name={open ? "expand_less" : "expand_more"} />{label}
      </button>
      {open ? (
        <div className="details-grid">
          {visible.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <span className="k">{k}</span>
              <span className="v">{v}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
