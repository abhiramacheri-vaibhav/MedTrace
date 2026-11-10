import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { ROLE_HOME, ROLE_ICONS, ROLE_LABELS, shortAddr } from "../lib/contract.js";

export default function Connect() {
  const w = useWallet();
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);
  const connected = w.account && !w.wrongNetwork && w.role;

  // Connected: a thin bar fills over 1.5 s, then the page changes.
  useEffect(() => {
    if (!connected || w.role === "sensor") return;
    const t = setTimeout(() => nav(ROLE_HOME[w.role]), 1500);
    return () => clearTimeout(t);
  }, [connected, w.role, nav]);

  return (
    <main className="center">
      <div className="card hero">
        {!w.account && (
          <>
            <div className="glyph"><Icon name="medication" fill /></div>
            <div className="stack" style={{ gap: 12 }}>
              <h1 style={{ textWrap: "balance" }}>Track medicine batches from factory to patient</h1>
              <p className="lead">Factories, distributors, pharmacies and the regulator sign every hand-off into one shared record. Connect your account to see your batches.</p>
            </div>
            <button className="btn h56 block" onClick={w.connect} disabled={w.busy}>
              {w.busy ? <><span className="spin lg" /> Connecting…</> : <><Icon name="link" />Connect your account</>}
            </button>
            <p className="help" style={{ marginTop: -8, textAlign: "center" }}>{w.error || "Your wallet app will open and ask you to approve."}</p>
            <div className="divider" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <span className="ink2">Just checking a medicine? No account needed.</span>
              <Link to="/verify" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Verify my medicine<Icon name="arrow_forward" /></Link>
            </div>
          </>
        )}

        {w.account && w.wrongNetwork && (
          <>
            <div className="glyph round neutral"><Icon name="lan" size={30} /></div>
            <div className="stack" style={{ gap: 12 }}>
              <h1>Your wallet is on the wrong network</h1>
              <p className="lead">MedTrace runs on the {w.network?.name || "test network"}, and your wallet is set to a different one. Switch networks to continue. Nothing has been saved or spent.</p>
            </div>
            <button className="btn h56 block" onClick={w.switchNetwork}><Icon name="sync_alt" />Switch to the test network</button>
            <button className="linkbtn" style={{ alignSelf: "center", fontWeight: 600 }} onClick={w.disconnect}>Disconnect</button>
          </>
        )}

        {connected && (
          <>
            <div className="glyph round safe"><Icon name="check_circle" fill /></div>
            <div className="stack" style={{ gap: 8 }}>
              <div style={{ fontWeight: 600, color: "var(--safe-ink)" }}>Connected</div>
              <h1>{w.name || ROLE_LABELS[w.role]}</h1>
              <div className="row lead" style={{ gap: 8 }}><Icon name={ROLE_ICONS[w.role]} size={22} />You're signed in as a {ROLE_LABELS[w.role]}.</div>
            </div>
            {w.role !== "sensor" ? (
              <>
                <div className="stack" style={{ gap: 8 }}>
                  <div className="progress"><div /></div>
                  <div className="ink2">Taking you to your page…</div>
                </div>
                <Link className="btn h56 block" to={ROLE_HOME[w.role]}>Go to my page<Icon name="arrow_forward" /></Link>
              </>
            ) : <p className="help">Sensor accounts post readings from the simulator; there's no page for them here.</p>}
          </>
        )}

        {w.account && !w.wrongNetwork && !w.role && (
          <>
            <div className="glyph round neutral"><Icon name="person_off" size={30} /></div>
            <div className="stack" style={{ gap: 12 }}>
              <h1>This account has no role yet</h1>
              <p className="lead">MedTrace doesn't recognise this account as a factory, distributor, pharmacy or regulator. Ask your MedTrace administrator to add it, then connect again.</p>
            </div>
            <button className="btn h56 block" onClick={async () => { await window.ethereum?.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] }).catch(() => {}); w.connect(); }}><Icon name="swap_horiz" />Connect a different account</button>
            <Link to="/verify" style={{ alignSelf: "center" }}>Verify a medicine instead</Link>
            <div className="divider" style={{ paddingTop: 12 }}>
              <div className="row small" style={{ gap: 16, color: "var(--ink2)" }}>
                <span>Account</span><span className="mono" style={{ color: "var(--ink)" }}>{shortAddr(w.account)}</span>
                <button className="linkbtn" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={() => { navigator.clipboard?.writeText(w.account); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Icon name="content_copy" size={18} />{copied ? "Copied" : "Copy"}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
