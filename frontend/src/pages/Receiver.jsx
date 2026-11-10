// Shared page for distributors and pharmacies: deliveries waiting for you, then batches you hold.
import { useState } from "react";
import Icon from "../components/Icon.jsx";
import BatchRow from "../components/BatchRow.jsx";
import Empty from "../components/Empty.jsx";
import Dialog from "../components/Dialog.jsx";
import HandOffDialog from "../components/HandOffDialog.jsx";
import Timeline from "../components/Timeline.jsx";
import TxButton from "../components/TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { useBatches, useBatchHistory } from "./useBatches.js";
import { ACTION, ROLE_ICONS, dateOf, rangeC, shortAddr, when } from "../lib/contract.js";

const COPY = {
  distributor: { title: "Deliveries and batches", sub: "Accept deliveries handed to you, then hand each batch on to a pharmacy.", from: "a factory" },
  pharmacy: { title: "Deliveries and stock", sub: "Accept deliveries, then dispense batches to patients.", from: "a distributor" },
};

export default function Receiver({ kind }) {
  const w = useWallet();
  const { batches, loading, reload, tick } = useBatches(w.reader);
  const [handoff, setHandoff] = useState(null);
  const [dispense, setDispense] = useState(null);
  const me = w.account?.toLowerCase();
  const c = COPY[kind];
  const label = (a) => w.who(a)?.name || shortAddr(a);

  const incoming = batches.filter((b) => b.status === 1 && b.pendingHolder?.toLowerCase() === me);
  const held = batches.filter((b) => b.currentHolder?.toLowerCase() === me && b.status !== 1);

  return (
    <main className="page w1280">
      <div className="page-head"><h1>{c.title}</h1><p className="lead">{c.sub}</p></div>

      <section className="section">
        <div className="section-head"><h2>Waiting for you to accept</h2><span className={`count ${incoming.length ? "wait" : ""}`}>{incoming.length}</span></div>
        {loading && !batches.length ? <Empty icon="hourglass_top" title="Loading…" text="Reading the shared record." /> : null}
        {!loading && !incoming.length ? <Empty icon="inbox" title="Nothing waiting for you" text={`When ${c.from} hands you a batch, it appears here for you to accept.`} /> : null}
        {incoming.map((b) => <WaitingCard key={b.id} batch={b} onDone={reload} refreshKey={tick} />)}
      </section>

      <section className="section">
        <div className="section-head"><h2>Batches you hold</h2><span className="count">{held.length}</span></div>
        {!loading && !held.length ? <Empty icon="inventory_2" title="You don't hold any batches" text="Accept a delivery above and it will appear here." /> : null}
        {held.map((b) => {
          const frozen = b.status === 3 || b.status === 4;
          const blocked = b.temperatureBreached || b.status === 4;
          const note = b.status === 3 ? "Dispensed to a patient. Record locked."
            : b.status === 4 ? "Recalled by the regulator. Keep it aside; it can't be moved or dispensed."
            : b.temperatureBreached ? `Can't dispense. This batch went above its safe range of ${rangeC(b.minTempTenthsC, b.maxTempTenthsC)}. Keep it aside for the regulator.` : "";
          const noteKind = b.status === 3 ? "lock" : blocked ? "danger" : "info";
          return (
            <BatchRow key={b.id} batch={b} refreshKey={tick} note={note} noteKind={noteKind}
              actions={frozen ? null : (
                <>
                  <button className="btn secondary h44" onClick={() => setHandoff(b)}><Icon name="arrow_forward" />Hand off to…</button>
                  {kind === "pharmacy" ? (
                    <button className="btn outline h44" disabled={blocked} title={blocked ? "This batch can't be dispensed" : ""} onClick={() => setDispense(b)}><Icon name="person" />Dispense to patient</button>
                  ) : null}
                </>
              )} />
          );
        })}
      </section>

      {handoff ? <HandOffDialog batch={handoff} open onClose={() => setHandoff(null)} onDone={reload} /> : null}
      {dispense ? <DispenseDialog batch={dispense} onClose={() => setDispense(null)} onDone={reload} /> : null}
    </main>
  );
}

function WaitingCard({ batch, onDone, refreshKey }) {
  const w = useWallet();
  const { history } = useBatchHistory(w.reader, batch, refreshKey);
  const from = w.who(batch.currentHolder);
  const sent = [...history].reverse().find((h) => h.action === ACTION.CustodyTransferred)?.timestamp;
  return (
    <div className="waiting">
      <div className="between" style={{ gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <div className="from"><Icon name={ROLE_ICONS[from?.role] || "store"} />From {from?.name || shortAddr(batch.currentHolder)}{sent ? ` · sent ${when(sent)}` : ""}</div>
          <div className="product">{batch.productName}</div>
          <div className="metas" style={{ display: "flex", gap: "4px 20px", flexWrap: "wrap", color: "var(--ink2)" }}><span>Lot {batch.lotNumber}</span><span>Expires {dateOf(batch.expiryDate)}</span><span>Safe {rangeC(batch.minTempTenthsC, batch.maxTempTenthsC)}</span></div>
        </div>
        <div className="accept">
          <TxButton className="btn h56" icon="inventory" send={() => w.writer.confirmReceipt(batch.id)} success="Delivery accepted" successBody={`${batch.productName}, lot ${batch.lotNumber} is now with you. Saved on the blockchain.`} failTitle="Couldn't accept the delivery" onDone={onDone}>Accept delivery</TxButton>
          <div className="help">Accept once the delivery is physically with you. The batch then moves to you.</div>
        </div>
      </div>
      <Timeline batch={batch} history={history} who={w.who} size="full" />
    </div>
  );
}

function DispenseDialog({ batch, onClose, onDone }) {
  const w = useWallet();
  const { history } = useBatchHistory(w.reader, batch);
  const preview = { ...batch, status: 3 };
  return (
    <Dialog open onClose={onClose} eyebrow={`${batch.productName} · Lot ${batch.lotNumber}`} title="Dispense to a patient?"
      footer={<>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <TxButton className="btn" icon="person" send={() => w.writer.markDispensed(batch.id)} success="Dispensed to patient" successBody={`${batch.productName}, lot ${batch.lotNumber} is now locked. Saved on the blockchain.`} failTitle="Couldn't dispense the batch" onDone={() => { onDone(); onClose(); }}>Dispense to patient</TxButton>
      </>}>
      <div className="panel callout"><Icon name="lock" fill size={24} style={{ color: "var(--ink2)" }} /><span>Once dispensed, this batch is locked. No one can hand it off again. Patients can still check it with Verify my medicine.</span></div>
      <Timeline batch={preview} history={history} who={w.who} size="compact" showHead={false} />
    </Dialog>
  );
}
