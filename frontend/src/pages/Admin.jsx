// Network operator: onboard participants (give an account a role and a display name).
import { useState } from "react";
import Icon from "../components/Icon.jsx";
import TxButton from "../components/TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { ROLE_ICONS, ROLE_IDS, ROLE_LABELS, shortAddr } from "../lib/contract.js";

export default function Admin() {
  const w = useWallet();
  const blank = { account: "", role: "manufacturer", name: "" };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value.trimStart() });
  const ready = /^0x[0-9a-fA-F]{40}$/.test(f.account) && f.name.trim();
  const roster = Object.values(w.participants);
  return (
    <main className="page w1360">
      <div className="page-head"><h1>Network operator</h1><p className="lead">Give an account a role so it can take part in the supply chain.</p></div>
      <div className="two-col">
        <div className="card">
          <h2>Onboard a participant</h2>
          <div className="field"><label>Account</label><input value={f.account} onChange={set("account")} placeholder="0x…" className="mono" /></div>
          <div className="field"><label>Role</label>
            <select value={f.role} onChange={set("role")}>{["manufacturer", "distributor", "pharmacy", "regulator", "sensor"].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
          </div>
          <div className="field"><label>Display name</label><input value={f.name} onChange={set("name")} placeholder="e.g. Acme Pharma" /><div className="help">Shown instead of the account everywhere in the app.</div></div>
          <TxButton className="btn h52 block" icon="person_add" disabled={!ready} send={() => w.writer.registerParticipant(f.account, ROLE_IDS[f.role], f.name.trim())} success={`${f.name} onboarded`} successBody={`Now a ${ROLE_LABELS[f.role]}.`} failTitle="Couldn't onboard the participant" onDone={() => { setF(blank); w.refreshParticipants(); }}>Onboard participant</TxButton>
        </div>
        <section className="section">
          <div className="section-head"><h2>Participants</h2><span className="count">{roster.length}</span></div>
          {roster.length ? (
            <div className="table">
              {roster.map((p) => (
                <div key={p.address} className="tbody-row" style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 24px" }}>
                  <div className="who"><div className="avatar"><Icon name={ROLE_ICONS[p.role] || "person"} /></div><div className="lines"><span className="org">{p.name}</span><span className="role">{ROLE_LABELS[p.role] || "Unknown role"}</span></div></div>
                  <span style={{ flex: 1 }} />
                  <span className="mono ink2">{shortAddr(p.address)}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty"><div><div className="t">No participants yet</div><div className="s">Onboard the factory, distributor, pharmacy and regulator accounts to get started.</div></div></div>}
        </section>
      </div>
    </main>
  );
}
