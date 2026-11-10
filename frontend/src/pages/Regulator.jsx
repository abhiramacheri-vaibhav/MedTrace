// Regulator: every batch in a table. Certify, recall (with a reason), expand a row for the timeline.
import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon.jsx";
import Dialog from "../components/Dialog.jsx";
import Timeline from "../components/Timeline.jsx";
import TxButton from "../components/TxButton.jsx";
import Empty from "../components/Empty.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { useBatches } from "./useBatches.js";
import { ACTION, ROLE_LABELS, STATE_CHIP, loadTempAlerts, normalizeHistory, shortAddr, timelineState, when } from "../lib/contract.js";

const TABS = [
  { key: "all", label: "All batches", test: () => true },
  { key: "certify", label: "Needs certifying", test: (b) => !b.certified && b.status !== 4 && !b.temperatureBreached },
  { key: "alerts", label: "Temperature alerts", test: (b) => b.temperatureBreached },
  { key: "recalled", label: "Recalled", test: (b) => b.status === 4 },
];

export default function Regulator() {
  const w = useWallet();
  const { batches, loading, reload, tick } = useBatches(w.reader);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [recall, setRecall] = useState(null);

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab);
    const needle = q.trim().toLowerCase();
    return batches.filter(t.test).filter((b) => !needle || b.productName.toLowerCase().includes(needle) || b.lotNumber.toLowerCase().includes(needle)).sort((a, b) => b.id - a.id);
  }, [batches, tab, q]);

  return (
    <main className="page w1440" style={{ gap: 24 }}>
      <div className="between" style={{ alignItems: "flex-end" }}>
        <div className="page-head"><h1>All batches</h1><p className="lead">Certify batches that meet standards. Recall any batch that isn't safe.</p></div>
        <div className="search"><Icon name="search" /><input placeholder="Search by product or lot number" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        {TABS.map((t) => <button key={t.key} className={`pill-tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>{t.label}<span>{batches.filter(t.test).length}</span></button>)}
      </div>
      {loading && !batches.length ? <Empty icon="hourglass_top" title="Loading batches…" text="Reading the shared record." /> : null}
      {!loading && !rows.length ? <Empty icon="search_off" title={tab === "recalled" ? "No recalled batches" : tab === "alerts" ? "No temperature alerts" : tab === "certify" ? "Nothing needs certifying" : "No batches match"} text={tab === "recalled" ? "Batches you recall will appear here." : tab === "alerts" ? "Batches whose sensor reported a breach will appear here." : "Try another filter or search."} /> : null}
      {rows.length ? (
        <div className="table">
          <div className="trow thead"><span>Batch</span><span>Now with</span><span>Status</span><span>Certified</span><span style={{ textAlign: "right" }}>Actions</span></div>
          {rows.map((b) => <Row key={b.id} batch={b} open={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)} onRecall={() => setRecall(b)} onDone={reload} refreshKey={tick} />)}
        </div>
      ) : null}
      {recall ? <RecallDialog batch={recall} onClose={() => setRecall(null)} onDone={reload} /> : null}
    </main>
  );
}

function Row({ batch: b, open, onToggle, onRecall, onDone, refreshKey }) {
  const w = useWallet();
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    let live = true;
    (async () => {
      const [h, a] = await Promise.all([w.reader.getHistory(b.id), b.temperatureBreached ? loadTempAlerts(w.reader, b.id) : []]);
      if (live) { setHistory(normalizeHistory(h)); setAlerts(a); }
    })();
    return () => { live = false; };
  }, [b.id, b.status, b.certified, b.temperatureBreached, w.reader, refreshKey]);

  const state = timelineState(b);
  const chip = STATE_CHIP[state];
  const holder = b.status === 3 ? { name: "Patient", role: `Dispensed by ${w.who(b.currentHolder)?.name || shortAddr(b.currentHolder)}` }
    : b.status === 1 ? { name: w.who(b.currentHolder)?.name || shortAddr(b.currentHolder), role: `Waiting for ${w.who(b.pendingHolder)?.name || shortAddr(b.pendingHolder)}` }
    : { name: w.who(b.currentHolder)?.name || shortAddr(b.currentHolder), role: ROLE_LABELS[w.who(b.currentHolder)?.role] || "" };
  const recalled = b.status === 4, done = b.status === 3;
  const recalledAt = history.find((h) => h.action === ACTION.Recalled)?.timestamp;
  const canCertify = !b.certified && !recalled && !b.temperatureBreached;

  return (
    <div className="tbody-row">
      <div className="trow">
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{b.productName}</span>
          <span className="row small ink2" style={{ gap: 14 }}>Lot {b.lotNumber}<button className="linkbtn" style={{ color: "var(--accent)", fontWeight: 600, gap: 2 }} onClick={onToggle}><Icon name={open ? "expand_less" : "expand_more"} size={18} />{open ? "Hide timeline" : "Show timeline"}</button></span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}><span style={{ fontWeight: 600 }}>{holder.name}</span><span className="small ink2">{holder.role}</span></div>
        <div><span className={`chip sm ${chip.tone}`}><Icon name={chip.icon} fill />{chip.text}</span></div>
        <div className="row" style={{ gap: 6, color: b.certified ? "var(--accent-hover)" : "var(--ink3)" }}>{b.certified ? <><Icon name="verified" fill />Certified</> : recalled ? "—" : "Not yet"}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {!b.certified && !recalled ? (
            <TxButton className="btn h40" icon="verified" disabled={!canCertify} title={!canCertify ? "Can't certify a batch with a temperature alert" : "Certify this batch"}
              send={() => w.writer.certifyBatch(b.id, "")} success={`${b.productName} certified`} successBody={`Lot ${b.lotNumber} now shows as certified everywhere.`} failTitle="Couldn't certify the batch" onDone={onDone}>Certify</TxButton>
          ) : null}
          {!recalled && !done ? <button className="btn recall h40" onClick={onRecall}><Icon name="block" />Recall</button> : null}
          {recalled ? <span className="small ink2">Recalled {recalledAt ? when(recalledAt).split(",")[0] : ""}</span> : null}
        </div>
      </div>
      {open ? <div className="texpand"><Timeline batch={b} history={history} who={w.who} alerts={alerts} size="full" /></div> : null}
    </div>
  );
}

function RecallDialog({ batch, onClose, onDone }) {
  const w = useWallet();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const missing = !reason.trim();
  return (
    <Dialog open onClose={onClose} eyebrow={`${batch.productName} · Lot ${batch.lotNumber}`} title="Recall this batch?"
      footer={<>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <TxButton className="btn danger" icon="block" disabled={missing} send={() => w.writer.recallBatch(batch.id, reason.trim())} success={`${batch.productName} recalled`} successBody="Everyone holding it now sees it as recalled." failTitle="Couldn't recall the batch" onDone={() => { onDone(); onClose(); }}>Recall batch</TxButton>
      </>}>
      <p style={{ fontSize: 17, lineHeight: 1.5 }}>Everyone holding it will see it as recalled, and patients who check it will see “Do not use”. A recall can't be undone.</p>
      <div className="field">
        <label>Reason for recall</label>
        <textarea className={missing && touched ? "err" : ""} value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => setTouched(true)} placeholder="e.g. Stored above 8.0 °C for 25 minutes" />
        {missing && touched ? <div className="ferr"><Icon name="error" fill />Write a reason. Pharmacies and patients will see it.</div> : <div className="help">Shown word for word on the patient page.</div>}
      </div>
    </Dialog>
  );
}
