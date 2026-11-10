// The custody timeline: the one visual that explains the two-step hand-off.
// Stops come from the batch history (every holder, in order). The token sits on the
// current holder, or between two stops while a hand-off is waiting to be accepted.
import { ACTION_LABELS, isZero, STATUS } from "../lib/contract.js";

export default function Timeline({ batch, history = [], names = {} }) {
  const label = (a) => names[a?.toLowerCase()] || (a ? `${a.slice(0, 6)}…` : "");

  // Holders in order: manufacturer, then every accepted receiver.
  const stops = [batch.manufacturer];
  for (const h of history) if (h.action === 2 && !stops.includes(h.actor)) stops.push(h.actor);
  const waiting = batch.status === 1 && !isZero(batch.pendingHolder);
  if (waiting && !stops.includes(batch.pendingHolder)) stops.push(batch.pendingHolder);
  if (stops.length === 1) stops.push(null); // show "next stop" placeholder on a fresh batch

  const n = stops.length;
  const pos = (i) => (n === 1 ? 0 : (i / (n - 1)) * 100);
  const holderIdx = Math.max(0, stops.indexOf(batch.currentHolder));
  const tokenPct = waiting ? (pos(holderIdx) + pos(stops.indexOf(batch.pendingHolder))) / 2 : pos(holderIdx);

  const final = batch.status === 3;
  const recalled = batch.status === 4;
  const tone = recalled ? "red" : final ? "green" : waiting ? "amber" : "";
  const tokenClass = recalled ? "recalled" : final ? "final" : waiting ? "waiting" : "";

  const caption = recalled
    ? "Recalled by the regulator. This batch is frozen."
    : final
    ? `Dispensed by ${label(batch.currentHolder)}. Journey complete.`
    : waiting
    ? `Handed off to ${label(batch.pendingHolder)}, waiting for them to accept.`
    : `Held by ${label(batch.currentHolder)}.`;

  return (
    <div className="timeline" aria-label={`Custody timeline, status ${STATUS[batch.status]}`}>
      <div className="tl-track">
        <div className={`tl-progress ${tone}`} style={{ width: `${tokenPct}%` }} />
        <div className={`tl-token ${tokenClass}`} style={{ left: `${tokenPct}%` }} title={STATUS[batch.status]}>
          {recalled ? "!" : final ? "✓" : "⬢"}
        </div>
      </div>
      <div className="tl-stops">
        {stops.map((s, i) => {
          const cls = s === null ? "" : s === batch.pendingHolder && waiting ? "pending" : i <= holderIdx ? (i === holderIdx ? "current" : "done") : "";
          return (
            <div key={i} className={`tl-stop ${cls}`}>
              <div className="node" />
              <div className="lbl">
                <b>{s === null ? "Next stop" : label(s)}</b>
                {s === null ? "not yet handed off" : i === 0 ? "factory" : s === batch.pendingHolder && waiting ? "waiting to accept" : "accepted"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="tl-caption">{caption}</div>
    </div>
  );
}

// A plain list version of the history for the details area.
export function HistoryList({ history, names = {} }) {
  const label = (a) => names[a?.toLowerCase()] || a;
  return (
    <ol className="small" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
      {history.map((h, i) => (
        <li key={i} style={{ marginBottom: 4 }}>
          <b>{ACTION_LABELS[h.action]}</b> · {label(h.actor)} · {new Date(h.timestamp * 1000).toLocaleString()}
          {h.details ? <span className="muted"> · {h.details}</span> : null}
        </li>
      ))}
    </ol>
  );
}
