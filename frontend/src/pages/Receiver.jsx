// Shared page for distributors and pharmacies: deliveries coming in, then batches in your hands.
import { useState } from "react";
import BatchCard from "../components/BatchCard.jsx";
import Dialog from "../components/Dialog.jsx";
import Empty from "../components/Empty.jsx";
import HandOffDialog from "../components/HandOffDialog.jsx";
import Icon from "../components/Icon.jsx";
import PageHero from "../components/PageHero.jsx";
import Rail from "../components/Rail.jsx";
import { LiveTrack } from "../components/Track.jsx";
import TxButton from "../components/TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { useBatches } from "./useBatches.js";
import { ROLE_COLORS, ROLE_LABELS, productLook, shortAddr } from "../lib/contract.js";

const COPY = {
  distributor: { sub: "Accept deliveries, then pass them on to a pharmacy.", from: "the factory", next: "pharmacy" },
  pharmacy: { sub: "Accept deliveries, then give medicine to patients.", from: "the distributor", next: null },
};

export default function Receiver({ kind }) {
  const w = useWallet();
  const { batches, loading, reload, tick } = useBatches(w.reader);
  const [handoff, setHandoff] = useState(null);
  const [dispense, setDispense] = useState(null);
  const [leaving, setLeaving] = useState([]);
  const [arrived, setArrived] = useState([]);
  const me = w.account?.toLowerCase();
  const c = COPY[kind];
  const col = ROLE_COLORS[kind];

  // Accepted deliveries stay in the Incoming area for a moment so the truck can drive in.
  const waitingNow = batches.filter((b) => b.status === 1 && b.pendingHolder?.toLowerCase() === me);
  const incoming = batches.filter((b) => (b.status === 1 && b.pendingHolder?.toLowerCase() === me) || leaving.includes(b.id));
  const held = batches.filter((b) => b.currentHolder?.toLowerCase() === me && b.status !== 1 && !leaving.includes(b.id))
    .sort((a, b) => (arrived.includes(b.id) - arrived.includes(a.id)) || b.id - a.id);
  const nextP = c.next ? Object.values(w.participants).find((p) => p.role === c.next) : null;
  const tooWarm = held.filter((b) => b.temperatureBreached && b.status !== 3 && b.status !== 4).length;
  const accepted = (id) => {
    setLeaving((l) => [...l, id]);
    setArrived((a) => [...a, id]);
    reload();
    setTimeout(() => setLeaving((l) => l.filter((x) => x !== id)), 1900);
  };

  return (
    <main className="page">
      <PageHero color={col} title={`Hey, ${w.name || ROLE_LABELS[kind]}!`} sub={c.sub}
        stats={kind === "pharmacy"
          ? [{ icon: "local_shipping", col: "#FFB020", n: waitingNow.length, label: "incoming" }, { icon: "local_fire_department", col: "#F0483E", n: tooWarm, label: "too warm" }]
          : [{ icon: "local_shipping", col: "#FFB020", n: waitingNow.length, label: "incoming" }, { icon: "inventory_2", col, n: held.length, label: "in your hands" }]} />

      {loading && !batches.length ? <Empty mood="wait" color={col} title="Loading…" text="Reading the shared record." /> : null}
      {incoming.map((b) => <IncomingCard key={b.id} batch={b} refreshKey={tick} onAccepted={() => accepted(b.id)} />)}
      {!loading && !incoming.length ? <Empty mood="happy" color={col} title="All caught up!" text={`New deliveries from ${c.from} pop up here.`} /> : null}

      <Rail title="In your hands" count={held.length}
        empty={<Empty mood="sleep" color={col} title="Nothing in your hands" text="Accept a delivery above and it lands here." />}>
        {held.map((b) => {
          const done = b.status === 3, recalled = b.status === 4, warm = b.temperatureBreached && !done && !recalled;
          const badge = done ? "Done!" : recalled ? "Recalled" : warm ? "Too warm!" : arrived.includes(b.id) ? "Just arrived" : "";
          const badgeKind = done ? "done" : recalled || warm ? "alert" : "new";
          const note = done ? "Given to a patient · locked" : recalled ? "Recalled. Keep it aside." : warm ? (kind === "pharmacy" ? "Too warm. Can't dispense." : "It got too warm on the way.") : "";
          const noteKind = done ? "lock" : recalled || warm ? "danger" : "info";
          let actions = null;
          if (!done && !recalled) {
            actions = kind === "pharmacy"
              ? <button className="btn go sm" disabled={warm} title={warm ? "This batch can't be dispensed" : ""} onClick={() => setDispense(b)}><Icon name={warm ? "block" : "favorite"} fill />Dispense to patient</button>
              : <button className="btn sm" onClick={() => setHandoff({ batch: b, to: nextP?.address })}><Icon name="local_shipping" fill />Hand off to…</button>;
          }
          return <BatchCard key={b.id} batch={b} refreshKey={tick} badge={badge} badgeKind={badgeKind} alertBorder={warm || recalled} note={note} noteKind={noteKind} noteIcon={recalled ? "block" : undefined} actions={actions} />;
        })}
      </Rail>

      {handoff ? <HandOffDialog batch={handoff.batch} initialTo={handoff.to} open onClose={() => setHandoff(null)} onDone={reload} /> : null}
      {dispense ? <DispenseDialog batch={dispense} onClose={() => setDispense(null)} onDone={reload} /> : null}
    </main>
  );
}

function IncomingCard({ batch, onAccepted, refreshKey }) {
  const w = useWallet();
  const look = productLook(batch.productName);
  const done = batch.status !== 1;
  const from = w.who(done ? batch.manufacturer : batch.currentHolder);
  return (
    <div className="box incoming">
      <div className="inc-left">
        <span className={`inc-tag ${done ? "done" : ""}`}><Icon name={done ? "check_circle" : "local_shipping"} className={done ? "" : "truck"} />{done ? "Got it!" : "Incoming!"}</span>
        <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
          <div className="tile s64 wig" style={{ background: look.color, transform: "rotate(-4deg)" }}><Icon name={look.icon} /></div>
          <div>
            <div className="inc-name">{batch.productName}</div>
            <div className="inc-meta">{batch.lotNumber} · from {from?.name || shortAddr(batch.currentHolder)}</div>
          </div>
        </div>
        {done ? (
          <button className="btn go xl block" disabled style={{ background: "var(--safe)", color: "#fff", borderColor: "var(--ink)" }}><Icon name="check_circle" fill />Accepted</button>
        ) : (
          <TxButton className="btn go xl block pulse" icon="inventory" iconFill send={() => w.writer.confirmReceipt(batch.id)}
            success="Delivery accepted!" successBody={`${batch.productName} ${batch.lotNumber} is now with you.`} failTitle="Couldn't accept it" onDone={onAccepted}>
            Accept delivery
          </TxButton>
        )}
        <span className="inc-help">{done ? "It's in your hands now." : "Got the boxes? Tap to accept."}</span>
      </div>
      <LiveTrack batch={batch} refreshKey={refreshKey} size="full" />
    </div>
  );
}

function DispenseDialog({ batch, onClose, onDone }) {
  const w = useWallet();
  return (
    <Dialog open onClose={onClose} title="Dispense to patient?" sub={`${batch.productName} · ${batch.lotNumber}`}
      art={
        <div className="d-art">
          <div className="tile s80 tilt-l" style={{ background: "#5B4CF5" }}><Icon name="pill" /></div>
          <Icon name="arrow_forward" />
          <div className="tile s80 tilt-r" style={{ background: "#FF6FA8" }}><Icon name="favorite" /></div>
        </div>
      }
      footer={<>
        <button className="btn white" onClick={onClose}>Not yet</button>
        <TxButton className="btn go" icon="favorite" iconFill send={() => w.writer.markDispensed(batch.id)} success="Dispensed!" successBody={`${batch.productName} ${batch.lotNumber} is with the patient and locked.`} failTitle="Couldn't dispense it" onDone={() => { onDone(); onClose(); }}>
          Dispense to patient
        </TxButton>
      </>}>
      <div className="note safe" style={{ fontSize: 17 }}><Icon name="lock" fill />The batch gets locked. No more hand-offs.</div>
    </Dialog>
  );
}

