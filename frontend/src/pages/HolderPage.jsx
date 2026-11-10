// Shared page for anyone who physically holds batches (factory, distributor, pharmacy):
// "waiting for you to accept" first, then "you hold these", with the right actions.
import { useState } from "react";
import { useWallet } from "../lib/wallet.jsx";
import { useBatches } from "./useBatches.js";
import BatchCard from "../components/BatchCard.jsx";
import TxButton from "../components/TxButton.jsx";

export default function HolderPage({ title, intro, extraActions, children }) {
  const w = useWallet();
  const { batches, loading, reload, tick } = useBatches(w.reader);
  const me = w.account?.toLowerCase();

  const incoming = batches.filter((b) => b.pendingHolder?.toLowerCase() === me && b.status === 1);
  const mine = batches.filter((b) => b.currentHolder?.toLowerCase() === me && b.status !== 1);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">{intro}</p>
        </div>
        <button className="btn secondary" onClick={reload}>Refresh</button>
      </div>

      {children ? <section style={{ marginBottom: 24 }}>{children({ reload })}</section> : null}

      <section className="stack" style={{ marginBottom: 28 }}>
        <h2>Waiting for you to accept {incoming.length ? <span className="pill amber">{incoming.length}</span> : null}</h2>
        {loading && !batches.length ? <div className="empty">Loading batches…</div> : null}
        {!loading && !incoming.length ? <div className="empty"><strong>Nothing waiting</strong>When someone hands a batch to you, it appears here.</div> : null}
        {incoming.map((b) => (
          <BatchCard key={b.id} batch={b} reader={w.reader} refreshKey={tick}
            actions={<TxButton className="btn success big" send={() => w.writer.confirmReceipt(b.id)} success={`Delivery of batch #${b.id} accepted`} onDone={reload}>Accept delivery</TxButton>} />
        ))}
      </section>

      <section className="stack">
        <h2>Batches you hold {mine.length ? <span className="pill accent">{mine.length}</span> : null}</h2>
        {!loading && !mine.length ? <div className="empty"><strong>You hold no batches</strong>Accepted deliveries show up here.</div> : null}
        {mine.map((b) => (
          <BatchCard key={b.id} batch={b} reader={w.reader} refreshKey={tick}
            actions={b.status === 3 || b.status === 4 ? <span className="muted small">This batch is frozen.</span> : <HandOff batch={b} onDone={reload} extra={extraActions?.(b, reload)} />} />
        ))}
      </section>
    </main>
  );
}

// "Hand off to…" picks a receiver by address; the contract checks they're a distributor or pharmacy.
function HandOff({ batch, onDone, extra }) {
  const w = useWallet();
  const [to, setTo] = useState("");
  const valid = /^0x[0-9a-fA-F]{40}$/.test(to);
  return (
    <div className="row" style={{ width: "100%" }}>
      <input placeholder="Receiver's account (0x…)" value={to} onChange={(e) => setTo(e.target.value.trim())} style={{ maxWidth: 420 }} />
      <TxButton send={() => w.writer.transferCustody(batch.id, to)} success={`Batch #${batch.id} handed off. Waiting for them to accept.`} onDone={() => { setTo(""); onDone(); }} className={`btn ${valid ? "" : "secondary"}`}>
        Hand off to…
      </TxButton>
      {extra}
    </div>
  );
}
