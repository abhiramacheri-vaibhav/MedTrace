// Network operator: give an account a role and a display name.
import { useState } from "react";
import Icon from "../components/Icon.jsx";
import PageHero from "../components/PageHero.jsx";
import TxButton from "../components/TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { ROLE_COLORS, ROLE_ICONS, ROLE_IDS, ROLE_LABELS, shortAddr } from "../lib/contract.js";

const ROLES = ["manufacturer", "distributor", "pharmacy", "regulator", "sensor"];

export default function Admin() {
  const w = useWallet();
  const blank = { account: "", role: "manufacturer", name: "" };
  const [f, setF] = useState(blank);
  const ready = /^0x[0-9a-fA-F]{40}$/.test(f.account.trim()) && f.name.trim();
  const roster = Object.values(w.participants);
  return (
    <main className="page">
      <PageHero color={ROLE_COLORS.admin} title="Network operator" sub="Give an account a role so it can join the supply chain."
        stats={[{ icon: "group", col: ROLE_COLORS.admin, n: roster.length, label: "participants" }]} />
      <div className="cols">
        <div className="box form-stack">
          <div className="box-head"><div className="tile s44" style={{ background: ROLE_COLORS.admin }}><Icon name="person_add" /></div><h2>Add a participant</h2></div>
          <div className="frow"><div className="ficon" style={{ background: "#1E1B3A" }}><Icon name="badge" /></div><label>Account<input className="mono" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} placeholder="0x…" /></label></div>
          <span className="flabel">Role</span>
          <div className="role-pick">
            {ROLES.map((r) => (
              <button type="button" key={r} className={`role-opt ${f.role === r ? "on" : ""}`} onClick={() => setF({ ...f, role: r })} aria-pressed={f.role === r}>
                <div className="tile s44 flat" style={{ background: ROLE_COLORS[r] }}><Icon name={ROLE_ICONS[r]} /></div>{r === "sensor" ? "Sensor" : ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="frow"><div className="ficon" style={{ background: "#FF6FA8" }}><Icon name="storefront" /></div><label>Display name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Acme Pharma" /></label></div>
          <TxButton className="btn lg block" icon="person_add" disabled={!ready} send={() => w.writer.registerParticipant(f.account.trim(), ROLE_IDS[f.role], f.name.trim())}
            success={`${f.name} added!`} successBody={`Now a ${ROLE_LABELS[f.role]}.`} failTitle="Couldn't add them" onDone={() => { setF(blank); w.refreshParticipants(); }}>
            Add participant
          </TxButton>
        </div>
        <div className="box">
          <div className="rail-head" style={{ marginBottom: 8 }}><div className="row" style={{ gap: 10 }}><span className="h-sec">Participants</span><span className="count">{roster.length}</span></div></div>
          {roster.length ? (
            <div className="roster">
              {roster.map((p) => (
                <div key={p.address}>
                  <div className="tile s48 flat wig" style={{ background: ROLE_COLORS[p.role] || "#8C8577" }}><Icon name={ROLE_ICONS[p.role] || "person"} /></div>
                  <div style={{ flex: 1 }}><div className="flabel">{p.name}</div><div className="ink2" style={{ fontSize: 14 }}>{ROLE_LABELS[p.role] || "Unknown role"}</div></div>
                  <span className="mono ink2">{shortAddr(p.address)}</span>
                </div>
              ))}
            </div>
          ) : <p className="ink2">No one yet. Add the factory, distributor, pharmacy and regulator to get started.</p>}
        </div>
      </div>
    </main>
  );
}
