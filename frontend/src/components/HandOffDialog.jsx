// "Hand off to…": pick the receiver from the onboarded distributors and pharmacies.
// Factories hand off to a distributor first; pharmacies are listed but disabled with the reason.
import { useMemo, useState } from "react";
import Dialog from "./Dialog.jsx";
import Icon from "./Icon.jsx";
import Timeline from "./Timeline.jsx";
import TxButton from "./TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { ROLE_ICONS, ROLE_LABELS } from "../lib/contract.js";
import { useBatchHistory } from "../pages/useBatches.js";

const PLACEHOLDER = "0x0000000000000000000000000000000000000001";

export default function HandOffDialog({ batch, open, onClose, onDone }) {
  const { participants, writer, role, account, who, reader } = useWallet();
  const { history } = useBatchHistory(reader, batch);
  const [to, setTo] = useState("");
  const [manual, setManual] = useState("");

  const options = useMemo(() => Object.values(participants)
    .filter((p) => (p.role === "distributor" || p.role === "pharmacy") && p.address.toLowerCase() !== account?.toLowerCase())
    .map((p) => ({ ...p, disabled: role === "manufacturer" && p.role === "pharmacy", why: role === "manufacturer" && p.role === "pharmacy" ? "factories hand off to a distributor first" : "" }))
    .sort((a, b) => (a.role === "distributor" ? -1 : 1) - (b.role === "distributor" ? -1 : 1)), [participants, role, account]);

  const target = to || (/^0x[0-9a-fA-F]{40}$/.test(manual) ? manual : "");
  const targetName = who(target)?.name || (target ? `${target.slice(0, 6)}…` : "");
  const preview = { ...batch, status: 1, pendingHolder: target || PLACEHOLDER };
  // Until a receiver is picked, the preview names the stop "the receiver" instead of a raw address.
  const previewWho = (a) => (a?.toLowerCase() === PLACEHOLDER ? { name: "the receiver", role: role === "manufacturer" ? "distributor" : "pharmacy" } : who(a));

  return (
    <Dialog open={open} onClose={onClose} wide eyebrow={`${batch.productName} · Lot ${batch.lotNumber}`} title="Hand off to…"
      footer={<>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <TxButton className="btn" disabled={!target} send={() => writer.transferCustody(batch.id, target)}
          success={`Hand-off sent to ${targetName}`} successBody="Saved on the blockchain. It waits for them to accept." failTitle="Hand-off didn't go through"
          onDone={() => { onDone?.(); onClose?.(); }}>
          Hand off{targetName ? ` to ${targetName}` : ""}<Icon name="arrow_forward" />
        </TxButton>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        {options.length === 0 ? <div className="help">No distributors or pharmacies have been onboarded yet. You can paste a receiver's account below.</div> : null}
        {options.map((p) => (
          <button key={p.address} className={`choice ${to === p.address ? "on" : ""}`} disabled={p.disabled} onClick={() => { setTo(p.address); setManual(""); }}>
            <span className="radio" />
            <Icon name={ROLE_ICONS[p.role]} />
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span className="l1">{p.name}</span>
              <span className="l2">{ROLE_LABELS[p.role]}{p.why ? ` · ${p.why}` : ""}</span>
            </span>
          </button>
        ))}
        <details className="dev-only" style={{ fontSize: 15 }}>
          <summary style={{ cursor: "pointer", color: "var(--ink2)" }}>Or paste an account address</summary>
          <input style={{ marginTop: 8 }} placeholder="0x…" value={manual} onChange={(e) => { setManual(e.target.value.trim()); setTo(""); }} />
        </details>
      </div>
      <div className="panel" style={{ paddingBottom: 0 }}>
        <div style={{ fontWeight: 700 }}>What happens next</div>
        <div className="ink2" style={{ fontSize: 16, lineHeight: 1.45, marginTop: 2 }}>The batch waits halfway until {targetName || "the receiver"} accepts the delivery. It stays in your list until then.</div>
        <Timeline batch={preview} history={history} who={previewWho} size="compact" showHead={false} />
      </div>
    </Dialog>
  );
}
