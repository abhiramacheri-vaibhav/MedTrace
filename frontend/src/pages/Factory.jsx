import { useState } from "react";
import Icon from "../components/Icon.jsx";
import BatchRow from "../components/BatchRow.jsx";
import Empty from "../components/Empty.jsx";
import HandOffDialog from "../components/HandOffDialog.jsx";
import TxButton from "../components/TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { useBatches } from "./useBatches.js";
import { shortAddr } from "../lib/contract.js";

export default function Factory() {
  const w = useWallet();
  const { batches, loading, reload, tick } = useBatches(w.reader);
  const [handoff, setHandoff] = useState(null);
  const me = w.account?.toLowerCase();
  const mine = batches.filter((b) => b.currentHolder?.toLowerCase() === me && b.status !== 3 && b.status !== 4);
  const label = (a) => w.who(a)?.name || shortAddr(a);

  return (
    <main className="page w1360">
      <div className="page-head">
        <h1>Your batches</h1>
        <p className="lead">Register each new batch, then hand it off to a distributor when it leaves the factory.</p>
      </div>
      <div className="two-col">
        <RegisterForm onDone={reload} />
        <section className="section">
          <div className="section-head"><h2>Batches you hold</h2><span className="count">{mine.length}</span></div>
          {loading && !batches.length ? <Empty icon="hourglass_top" title="Loading your batches…" text="Reading the shared record." /> : null}
          {!loading && !mine.length ? <Empty big icon="inventory_2" title="No batches yet" text="Register your first batch with the form on the left. It will appear here, ready to hand off to a distributor." /> : null}
          {mine.map((b) => (
            <BatchRow key={b.id} batch={b} refreshKey={tick}
              note={b.status === 1 ? `Sent to ${label(b.pendingHolder)}. It stays here until they accept the delivery.` : ""} noteKind="wait"
              actions={b.status === 1 ? null : <button className="btn secondary h44" onClick={() => setHandoff(b)}><Icon name="arrow_forward" />Hand off to…</button>} />
          ))}
        </section>
      </div>
      {handoff ? <HandOffDialog batch={handoff} open onClose={() => setHandoff(null)} onDone={reload} /> : null}
    </main>
  );
}

function RegisterForm({ onDone }) {
  const w = useWallet();
  const blank = { productName: "", lotNumber: "", expiry: "", low: "", high: "" };
  const [f, setF] = useState(blank);
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const low = Number(f.low), high = Number(f.high);
  const tempErr = f.low !== "" && f.high !== "" && !(low < high);
  const expiryErr = f.expiry && new Date(f.expiry).getTime() <= Date.now();
  const ready = f.productName && f.lotNumber && f.expiry && f.low !== "" && f.high !== "" && !tempErr && !expiryErr;

  return (
    <div className="card">
      <div>
        <h2>Register a batch</h2>
        <p className="ink2" style={{ marginTop: 4, lineHeight: 1.45 }}>Saved on the blockchain. It can't be edited afterwards, so check each detail.</p>
      </div>
      <div className="field"><label>Product name</label><input value={f.productName} onChange={set("productName")} placeholder="e.g. Amoxicillin 500 mg capsules" /></div>
      <div className="field"><label>Lot number</label><input value={f.lotNumber} onChange={set("lotNumber")} placeholder="e.g. A-2291" /></div>
      <div className="field">
        <label>Expiry date</label>
        <input type="date" className={expiryErr && touched ? "err" : ""} value={f.expiry} onChange={set("expiry")} onBlur={() => setTouched(true)} />
        {expiryErr && touched ? <div className="ferr"><Icon name="error" fill />The expiry date must be in the future.</div> : null}
      </div>
      <div className="field">
        <div className="pair">
          <div className="field"><label>Lowest safe temp.</label><div className="input-unit"><input type="number" step="0.1" className={tempErr ? "err" : ""} value={f.low} onChange={set("low")} placeholder="e.g. 2.0" /><span>°C</span></div></div>
          <div className="field"><label>Highest safe temp.</label><div className="input-unit"><input type="number" step="0.1" className={tempErr ? "err" : ""} value={f.high} onChange={set("high")} placeholder="e.g. 8.0" /><span>°C</span></div></div>
        </div>
        {tempErr ? <div className="ferr"><Icon name="error" fill />The highest temperature must be above the lowest. Swap the two numbers.</div> : null}
      </div>
      <div className="field">
        <label>Document <span className="opt">(optional)</span></label>
        <div className="upload" title="Document uploads are being built"><Icon name="upload_file" style={{ color: "var(--ink3)" }} size={22} /><span><b style={{ color: "var(--ink3)" }}>Add a document</b><span className="sub">Document uploads are in progress. Leave this empty for now.</span></span></div>
      </div>
      <TxButton className="btn h52 block" icon="add" disabled={!ready}
        send={() => w.writer.registerBatch(f.productName.trim(), f.lotNumber.trim(), Math.floor(new Date(f.expiry).getTime() / 1000), Math.round(low * 10), Math.round(high * 10), "")}
        success={`${f.productName} registered`} successBody={`Lot ${f.lotNumber} is now in your list, ready to hand off.`} failTitle="Couldn't register the batch"
        onDone={() => { setF(blank); setTouched(false); onDone(); }}>
        Register batch
      </TxButton>
    </div>
  );
}
