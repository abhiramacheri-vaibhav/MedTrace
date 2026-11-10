// Regulator's control tower: count tiles double as filters, every batch as a card, certify or recall.
import { useMemo, useState } from "react";
import BatchCard from "../components/BatchCard.jsx";
import Dialog from "../components/Dialog.jsx";
import Empty from "../components/Empty.jsx";
import Icon from "../components/Icon.jsx";
import PageHero from "../components/PageHero.jsx";
import Pip from "../components/Pip.jsx";
import TxButton from "../components/TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { useBatches } from "./useBatches.js";
import { ROLE_COLORS } from "../lib/contract.js";

const TILES = [
  { id: "all", label: "All batches", icon: "inventory_2", col: "#8B5CF6", test: () => true },
  { id: "stamp", label: "Need certifying", icon: "verified", col: "#5B4CF5", test: (b) => !b.certified && b.status !== 3 && b.status !== 4 },
  { id: "warm", label: "Too warm", icon: "local_fire_department", col: "#F0483E", test: (b) => b.temperatureBreached },
  { id: "recalled", label: "Recalled", icon: "block", col: "#B42318", test: (b) => b.status === 4 },
];
const EMPTY = {
  all: ["No batches yet", "Batches show up here once a factory registers them."],
  stamp: ["Nothing to certify", "Every active batch already has your stamp."],
  warm: ["No temperature alerts", "Batches the sensor flags show up here."],
  recalled: ["No recalled batches", "Batches you recall show up here."],
};

export default function Regulator() {
  const w = useWallet();
  const { batches, loading, reload, tick } = useBatches(w.reader);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [recall, setRecall] = useState(null);
  const rows = useMemo(() => {
    const t = TILES.find((x) => x.id === filter);
    const needle = q.trim().toLowerCase();
    return batches.filter(t.test).filter((b) => !needle || b.productName.toLowerCase().includes(needle) || b.lotNumber.toLowerCase().includes(needle)).sort((a, b) => b.id - a.id);
  }, [batches, filter, q]);

  return (
    <main className="page">
      <PageHero color={ROLE_COLORS.regulator} title="Control tower" sub="Certify the good ones. Recall the risky ones."
        right={<div className="search"><Icon name="search" /><input className="finput" placeholder="Find a product or lot" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search batches" /></div>} />
      <div className="ftiles">
        {TILES.map((t) => (
          <button key={t.id} className={`ftile ${filter === t.id ? "on" : ""}`} onClick={() => setFilter(t.id)} aria-pressed={filter === t.id}>
            <div className="tile flat" style={{ background: t.col }}><Icon name={t.icon} /></div>
            <div className="stat-txt"><span className="n">{batches.filter(t.test).length}</span><span className="l">{t.label}</span></div>
          </button>
        ))}
      </div>
      {loading && !batches.length ? <Empty mood="wait" color={ROLE_COLORS.regulator} title="Loading batches…" text="Reading the shared record." /> : null}
      {!loading && !rows.length ? <Empty mood="think" color={ROLE_COLORS.regulator} title={q ? "Nothing matches" : EMPTY[filter][0]} text={q ? "Try another product or lot number." : EMPTY[filter][1]} /> : null}
      <div className="cardgrid">
        {rows.map((b) => <RegCard key={b.id} batch={b} refreshKey={tick} onDone={reload} onRecall={() => setRecall(b)} />)}
      </div>
      {recall ? <RecallDialog batch={recall} onClose={() => setRecall(null)} onDone={reload} /> : null}
    </main>
  );
}

function RegCard({ batch: b, onRecall, onDone, refreshKey }) {
  const w = useWallet();
  const recalled = b.status === 4, done = b.status === 3;
  const warm = b.temperatureBreached && !recalled;
  let note = "", noteKind = "info", noteIcon;
  if (recalled) { note = "Recalled. Everyone sees “Do not use”."; noteKind = "danger"; noteIcon = "block"; }
  else if (done) { note = "With a patient · locked"; noteKind = "lock"; }
  else if (warm) { note = "Too warm. Certify is off."; noteKind = "danger"; }
  const actions = recalled || done ? null : (
    <>
      {!b.certified ? (
        <TxButton className="btn sm" icon="verified" iconFill disabled={warm} title={warm ? "Can't certify a batch that got too warm" : "Certify this batch"}
          send={() => w.writer.certifyBatch(b.id, "")} success="Certified!" successBody={`${b.productName} ${b.lotNumber} got your stamp.`} failTitle="Couldn't certify it" onDone={onDone}>
          Certify
        </TxButton>
      ) : null}
      <button className="btn recall sm" onClick={onRecall}><Icon name="block" />Recall</button>
    </>
  );
  return <BatchCard batch={b} refreshKey={refreshKey} actions={actions} note={note} noteKind={noteKind} noteIcon={noteIcon} badge={warm ? "Needs a look" : ""} badgeKind="alert" alertBorder={warm} />;
}

const REASONS = [
  { icon: "local_fire_department", text: "Got too warm" },
  { icon: "coronavirus", text: "Contamination" },
  { icon: "label_off", text: "Wrong label" },
  { icon: "inventory", text: "Damaged boxes" },
];

function RecallDialog({ batch, onClose, onDone }) {
  const w = useWallet();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const missing = !reason.trim();
  return (
    <Dialog open onClose={onClose} title="Recall this batch?" sub={`${batch.productName} · ${batch.lotNumber}`} art={<Pip size={110} mood="worried" color="#F0483E" />}
      footer={<>
        <button className="btn white" onClick={onClose}>Cancel</button>
        <TxButton className="btn danger" icon="block" disabled={missing} send={() => w.writer.recallBatch(batch.id, reason.trim())}
          success="Recalled!" successBody={`${batch.productName} ${batch.lotNumber} now shows “Do not use” everywhere.`} failTitle="Couldn't recall it"
          onDone={() => { onDone(); onClose(); }}>
          Recall batch
        </TxButton>
      </>}>
      <p className="ink2" style={{ fontSize: 17 }}>Everyone will see “Do not use”. This can't be undone.</p>
      <div className="d-left">
        <span className="flabel">Why? Pick one or write it</span>
        <div className="row" style={{ gap: 8 }}>
          {REASONS.map((r) => <button type="button" key={r.text} className={`reason ${reason === r.text ? "on" : ""}`} onClick={() => { setReason(r.text); setTouched(true); }}><Icon name={r.icon} />{r.text}</button>)}
        </div>
        <input className={`finput ${missing && touched ? "err" : ""}`} placeholder="Or type a reason…" value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => setTouched(true)} aria-label="Reason for recall" />
        {missing && touched ? <span className="ferr"><Icon name="error" />Add a reason. Pharmacies and patients will see it.</span> : <span className="ink2" style={{ fontSize: 14 }}>Shown word for word on the patient page.</span>}
      </div>
    </Dialog>
  );
}
