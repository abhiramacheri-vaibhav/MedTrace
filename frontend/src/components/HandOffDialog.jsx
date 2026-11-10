// "Hand off to…": pick the receiver from the onboarded distributors and pharmacies.
// Factories hand off to a distributor first, so pharmacies are listed but switched off with the reason.
import { useMemo, useState } from "react";
import Dialog from "./Dialog.jsx";
import Icon from "./Icon.jsx";
import { LiveTrack } from "./Track.jsx";
import TxButton from "./TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { ROLE_COLORS, ROLE_ICONS, ROLE_LABELS, shortAddr, shortName } from "../lib/contract.js";

const PLACEHOLDER = "0x0000000000000000000000000000000000000001";

export default function HandOffDialog({ batch, open, onClose, onDone, initialTo }) {
  const { participants, writer, role, account, who } = useWallet();
  const [to, setTo] = useState(initialTo || "");
  const [manual, setManual] = useState("");

  const options = useMemo(() => Object.values(participants)
    .filter((p) => (p.role === "distributor" || p.role === "pharmacy") && p.address.toLowerCase() !== account?.toLowerCase())
    .map((p) => ({ ...p, disabled: role === "manufacturer" && p.role === "pharmacy", why: role === "manufacturer" && p.role === "pharmacy" ? "factories hand off to a distributor first" : "" }))
    .sort((a, b) => (a.role === "distributor" ? -1 : 1) - (b.role === "distributor" ? -1 : 1)), [participants, role, account]);

  const target = to || (/^0x[0-9a-fA-F]{40}$/.test(manual) ? manual : "");
  const targetP = who(target);
  const targetName = targetP?.name || (target ? shortAddr(target) : "");
  const preview = { ...batch, status: 1, pendingHolder: target || PLACEHOLDER };
  const previewWho = (a) => (a?.toLowerCase() === PLACEHOLDER ? { name: "Next stop", role: role === "manufacturer" ? "distributor" : "pharmacy" } : who(a));

  return (
    <Dialog open={open} onClose={onClose} wide title="Hand off to…" sub={`${batch.productName} · ${batch.lotNumber}`}
      art={
        <div className="d-art">
          <div className="tile s80 tilt-l" style={{ background: ROLE_COLORS[role] }}><Icon name={ROLE_ICONS[role]} /></div>
          <Icon name="arrow_forward" />
          <div className="tile s80 tilt-r" style={{ background: target ? ROLE_COLORS[targetP?.role] || "#8C8577" : "#CFC6B8" }}><Icon name={target ? ROLE_ICONS[targetP?.role] || "store" : "question_mark"} /></div>
        </div>
      }
      footer={<>
        <button className="btn white" onClick={onClose}>Not yet</button>
        <TxButton className="btn" disabled={!target} send={() => writer.transferCustody(batch.id, target)}
          success="Hand-off sent!" successBody={`${targetName} needs to accept it.`} failTitle="Hand-off didn't go through"
          onDone={() => { onDone?.(); onClose?.(); }}>
          Hand off{targetName ? ` to ${shortName(targetName)}` : ""}<Icon name="arrow_forward" />
        </TxButton>
      </>}>
      <div className="d-left">
        {options.length === 0 ? <div className="note info"><Icon name="info" fill />No distributors or pharmacies have been added yet.</div> : null}
        {options.map((p) => (
          <button key={p.address} className={`choice ${to === p.address ? "on" : ""}`} disabled={p.disabled} onClick={() => { setTo(p.address); setManual(""); }}>
            <span className="radio" />
            <span className="tile s44 flat" style={{ background: ROLE_COLORS[p.role] }}><Icon name={ROLE_ICONS[p.role]} /></span>
            <span><span className="l1">{p.name}</span><span className="l2">{ROLE_LABELS[p.role]}{p.why ? ` · ${p.why}` : ""}</span></span>
          </button>
        ))}
        <details className="paste dev-only">
          <summary>Or paste an account address</summary>
          <input className="finput mono" style={{ marginTop: 8 }} placeholder="0x…" value={manual} onChange={(e) => { setManual(e.target.value.trim()); setTo(""); }} />
        </details>
      </div>
      <div className="d-panel">
        <div className="flabel" style={{ fontSize: 17 }}>What happens next</div>
        <div className="ink2" style={{ fontSize: 15 }}>The box waits halfway until {targetName || "they"} accept the delivery.</div>
        <LiveTrack batch={preview} size="compact" whoOverride={previewWho} />
      </div>
    </Dialog>
  );
}
