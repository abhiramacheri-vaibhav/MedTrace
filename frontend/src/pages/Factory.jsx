import { useState } from "react";
import HolderPage from "./HolderPage.jsx";
import TxButton from "../components/TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";

export default function Factory() {
  return (
    <HolderPage title="Factory" intro="Register new batches and hand them to a distributor.">
      {({ reload }) => <RegisterForm onDone={reload} />}
    </HolderPage>
  );
}

function RegisterForm({ onDone }) {
  const w = useWallet();
  const [f, setF] = useState({ productName: "", lotNumber: "", expiry: "", minC: "2", maxC: "8", coaCid: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ready = f.productName && f.lotNumber && f.expiry && Number(f.minC) < Number(f.maxC);

  return (
    <div className="card">
      <h2>Register a new batch</h2>
      <div className="form-grid">
        <div className="field"><label>Product name</label><input value={f.productName} onChange={set("productName")} placeholder="Insulin 100IU" /></div>
        <div className="field"><label>Lot number</label><input value={f.lotNumber} onChange={set("lotNumber")} placeholder="LOT-2026-001" /><div className="help">As printed on the box.</div></div>
        <div className="field"><label>Expiry date</label><input type="date" value={f.expiry} onChange={set("expiry")} /></div>
        <div className="field"><label>Lowest safe temperature (°C)</label><input type="number" step="0.1" value={f.minC} onChange={set("minC")} /></div>
        <div className="field"><label>Highest safe temperature (°C)</label><input type="number" step="0.1" value={f.maxC} onChange={set("maxC")} /></div>
        <div className="field"><label>Quality certificate document link (optional)</label><input value={f.coaCid} onChange={set("coaCid")} placeholder="Leave empty for now" /><div className="help">Document uploads are in progress; leave empty for the demo.</div></div>
      </div>
      <TxButton
        className={`btn ${ready ? "" : "secondary"}`}
        send={() => w.writer.registerBatch(
          f.productName, f.lotNumber,
          Math.floor(new Date(f.expiry).getTime() / 1000),
          Math.round(Number(f.minC) * 10), Math.round(Number(f.maxC) * 10),
          f.coaCid,
        )}
        success="Batch registered"
        onDone={() => { setF({ ...f, productName: "", lotNumber: "" }); onDone(); }}
      >
        Register batch
      </TxButton>
    </div>
  );
}
