// One batch in a list: title, meta, actions, an optional note, the compact timeline, and Details.
import { useState } from "react";
import Icon from "./Icon.jsx";
import Timeline from "./Timeline.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { ACTION_LABELS, dateOf, rangeC, shortAddr, when } from "../lib/contract.js";
import { useBatchHistory } from "../pages/useBatches.js";

const NOTE_ICON = { info: "info", wait: "hourglass_top", safe: "check_circle", lock: "lock", danger: "error" };

export default function BatchRow({ batch, actions, note, noteKind = "info", refreshKey, size = "compact", children }) {
  const { reader, who, network } = useWallet();
  const { history, alerts } = useBatchHistory(reader, batch, refreshKey);
  const [open, setOpen] = useState(false);

  const label = (a) => who(a)?.name || shortAddr(a);
  return (
    <div className="brow">
      <div className="between">
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="title">
            <span>{batch.productName}</span>
            {batch.certified ? <span className="chip sm accent"><Icon name="verified" fill />Certified</span> : null}
          </div>
          <div className="metas"><span>Lot {batch.lotNumber}</span><span>Expires {dateOf(batch.expiryDate)}</span><span>Safe {rangeC(batch.minTempTenthsC, batch.maxTempTenthsC)}</span></div>
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
      {note ? <div className={`note ${noteKind}`}><Icon name={NOTE_ICON[noteKind]} fill />{note}</div> : null}
      <div style={{ marginTop: 8 }}>
        <Timeline batch={batch} history={history} who={who} alerts={alerts} size={size} showHead={size === "full"} />
      </div>
      {children}
      <button className="details-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}><Icon name={open ? "expand_less" : "expand_more"} />Details</button>
      {open ? (
        <div className="details-grid">
          <span className="k">Batch id</span><span className="v">{batch.id}</span>
          <span className="k">Registered by account</span><span className="v">{batch.manufacturer}</span>
          <span className="k">Now with account</span><span className="v">{batch.currentHolder}</span>
          <span className="k">Registered</span><span className="v">{when(batch.manufactureDate)}</span>
          <span className="k">Record</span><span className="v">{network?.explorer ? <a href={`${network.explorer}/address/${reader.target}`} target="_blank" rel="noreferrer">View contract</a> : shortAddr(reader.target)}</span>
          {history.length ? <><span className="k">History</span><span className="v" style={{ fontFamily: "var(--font)" }}>
            {history.map((h, i) => <div key={i}>{ACTION_LABELS[h.action]} · {label(h.actor)} · {when(h.timestamp)}{h.details ? ` · ${h.details}` : ""}</div>)}
          </span></> : null}
        </div>
      ) : null}
    </div>
  );
}
