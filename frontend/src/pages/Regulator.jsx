// Regulator: certify or recall any batch. Calls certifyBatch / recallBatch (Vaibhav's module).
import { useState } from "react";
import { useWallet } from "../lib/wallet.jsx";
import { useBatches } from "./useBatches.js";
import BatchCard from "../components/BatchCard.jsx";
import TxButton from "../components/TxButton.jsx";

export default function Regulator() {
  const w = useWallet();
  const { batches, loading, reload, tick } = useBatches(w.reader);
  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Regulator</h1><p className="muted">Certify batches that pass review. Recall anything unsafe.</p></div>
        <button className="btn secondary" onClick={reload}>Refresh</button>
      </div>
      <section className="stack">
        {loading && !batches.length ? <div className="empty">Loading batches…</div> : null}
        {!loading && !batches.length ? <div className="empty"><strong>No batches yet</strong>Batches appear here once a factory registers them.</div> : null}
        {batches.map((b) => (
          <BatchCard key={b.id} batch={b} reader={w.reader} refreshKey={tick} actions={<RegulatorActions batch={b} onDone={reload} />} />
        ))}
      </section>
    </main>
  );
}

function RegulatorActions({ batch, onDone }) {
  const w = useWallet();
  const [reason, setReason] = useState("");
  const frozen = batch.status === 3 || batch.status === 4;
  if (frozen) return <span className="muted small">{batch.status === 4 ? "Recalled." : "Dispensed, nothing more to do."}</span>;
  return (
    <>
      {!batch.certified && (
        <TxButton className="btn success" send={() => w.writer.certifyBatch(batch.id, "")} success={`Batch #${batch.id} certified`} onDone={onDone}>Certify</TxButton>
      )}
      <input placeholder="Reason for recall" value={reason} onChange={(e) => setReason(e.target.value)} style={{ maxWidth: 320 }} />
      <TxButton className={`btn ${reason ? "danger" : "secondary"}`} send={() => w.writer.recallBatch(batch.id, reason)} success={`Batch #${batch.id} recalled`} onDone={() => { setReason(""); onDone(); }}
        confirm={`Recall batch #${batch.id}? This cannot be undone.`}>
        Recall
      </TxButton>
    </>
  );
}
