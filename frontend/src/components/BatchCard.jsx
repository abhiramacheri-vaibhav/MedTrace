// One batch: name, status, timeline, and whatever actions the current page passes in.
import { useEffect, useState } from "react";
import Timeline, { HistoryList } from "./Timeline.jsx";
import Details from "./Details.jsx";
import { dateOf, nameMap, normalizeHistory, STATUS, STATUS_TONE, tempC } from "../lib/contract.js";

export default function BatchCard({ batch, reader, actions, refreshKey }) {
  const [history, setHistory] = useState([]);
  const [names, setNames] = useState({});

  useEffect(() => {
    let live = true;
    (async () => {
      const h = normalizeHistory(await reader.getHistory(batch.id));
      const nm = await nameMap(reader, [batch.manufacturer, batch.currentHolder, batch.pendingHolder, ...h.map((x) => x.actor)]);
      if (live) { setHistory(h); setNames(nm); }
    })();
    return () => { live = false; };
  }, [batch.id, batch.status, batch.currentHolder, batch.pendingHolder, reader, refreshKey]);

  const expired = batch.expiryDate * 1000 < Date.now();
  return (
    <div className="card lift">
      <div className="card-head">
        <div>
          <div className="card-title">{batch.productName} <span className="muted">· lot {batch.lotNumber}</span></div>
          <div className="small muted">Batch #{batch.id} · keep between {tempC(batch.minTempTenthsC)} and {tempC(batch.maxTempTenthsC)} · expires {dateOf(batch.expiryDate)}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className={`pill ${STATUS_TONE[batch.status]}`}>{STATUS[batch.status]}</span>
          {batch.certified && <span className="pill green">Certified</span>}
          {batch.temperatureBreached && <span className="pill red">Temperature alert</span>}
          {expired && <span className="pill red">Expired</span>}
        </div>
      </div>
      <Timeline batch={batch} history={history} names={names} />
      {actions ? <div className="row" style={{ marginTop: 16 }}>{actions}</div> : null}
      <Details rows={[
        ["Batch id", batch.id],
        ["Factory", batch.manufacturer],
        ["Current holder", batch.currentHolder],
        ["Pending holder", batch.pendingHolder],
        ["Registered", dateOf(batch.manufactureDate)],
      ]} />
      {history.length ? <details className="tech"><summary>Full history ({history.length})</summary><HistoryList history={history} names={names} /></details> : null}
    </div>
  );
}
