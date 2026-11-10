// Network operator: onboard participants (give an account a role and a display name).
import { useState } from "react";
import { useWallet } from "../lib/wallet.jsx";
import TxButton from "../components/TxButton.jsx";
import { ROLE_IDS, ROLE_LABELS } from "../lib/contract.js";

export default function Admin() {
  const w = useWallet();
  const [f, setF] = useState({ account: "", role: "manufacturer", name: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value.trimStart() });
  const ready = /^0x[0-9a-fA-F]{40}$/.test(f.account) && f.name;
  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <h1>Network operator</h1>
      <p className="muted">Give an account a role so it can take part in the supply chain.</p>
      <div className="card">
        <div className="field"><label>Account (0x…)</label><input value={f.account} onChange={set("account")} placeholder="0x…" /></div>
        <div className="form-grid">
          <div className="field"><label>Role</label>
            <select value={f.role} onChange={set("role")}>
              {["manufacturer", "distributor", "pharmacy", "regulator", "sensor"].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="field"><label>Display name</label><input value={f.name} onChange={set("name")} placeholder="Acme Pharma" /></div>
        </div>
        <TxButton className={`btn ${ready ? "" : "secondary"}`} send={() => w.writer.registerParticipant(f.account, ROLE_IDS[f.role], f.name)} success={`${f.name} onboarded as ${ROLE_LABELS[f.role]}`} onDone={() => setF({ ...f, account: "", name: "" })}>
          Onboard participant
        </TxButton>
      </div>
    </main>
  );
}
