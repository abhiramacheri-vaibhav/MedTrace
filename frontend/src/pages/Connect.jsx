import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Confetti from "../components/Confetti.jsx";
import Icon from "../components/Icon.jsx";
import Pip from "../components/Pip.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { NETWORKS, ROLE_COLORS, ROLE_HOME, ROLE_ICONS, ROLE_LABELS, shortAddr } from "../lib/contract.js";

// Role tiles drifting around the card.
const FLOATS = [
  { role: "manufacturer", s: 120, pos: { left: "9%", top: "20%" }, r: "-8deg", d: "4s", delay: "0s" },
  { role: "distributor", s: 104, pos: { left: "15%", top: "64%" }, r: "6deg", d: "4.6s", delay: "0.6s" },
  { role: "pharmacy", s: 112, pos: { right: "11%", top: "18%" }, r: "8deg", d: "4.3s", delay: "0.3s" },
  { role: "regulator", s: 110, pos: { right: "15%", top: "63%" }, r: "-6deg", d: "5s", delay: "0.9s" },
];

export default function Connect() {
  const w = useWallet();
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);
  const connected = w.account && !w.wrongNetwork && w.role;

  // Connected: Pip celebrates, the bar fills, then the page changes.
  useEffect(() => {
    if (!connected || w.role === "sensor") return undefined;
    const t = setTimeout(() => nav(ROLE_HOME[w.role]), 1800);
    return () => clearTimeout(t);
  }, [connected, w.role, nav]);

  const mood = !w.account ? "happy" : w.wrongNetwork ? "worried" : w.role ? "party" : "think";
  const pipColor = w.wrongNetwork ? "#FF8A3D" : w.account && !w.role ? "#8B5CF6" : "#5B4CF5";
  const current = NETWORKS[w.chainId]?.name || (w.chainId ? `network ${w.chainId}` : "another network");

  return (
    <main className="connect">
      {FLOATS.map((f) => (
        <div key={f.role} className="float-tile" aria-hidden="true" style={{ ...f.pos, width: f.s, height: f.s, background: ROLE_COLORS[f.role], "--r": f.r, animationDuration: f.d, animationDelay: f.delay }}>
          <Icon name={ROLE_ICONS[f.role]} size={Math.round(f.s * 0.53)} />
        </div>
      ))}
      <div className="ccard">
        {connected ? <Confetti count={40} distance={640} /> : null}
        <Pip size={150} mood={mood} color={pipColor} />

        {!w.account && (
          <>
            <h1>Hi, I'm Pip!</h1>
            <p className="lead">I follow every medicine batch from factory to patient. Connect to see yours.</p>
            <div className="roles-mini">
              {["manufacturer", "distributor", "pharmacy", "regulator"].map((r) => (
                <div key={r}><div className="tile wig" style={{ background: ROLE_COLORS[r], boxShadow: "2px 2px 0 var(--ink)" }}><Icon name={ROLE_ICONS[r]} /></div>{ROLE_LABELS[r]}</div>
              ))}
            </div>
            <button className="btn lg block" onClick={w.connect} disabled={w.busy}>
              {w.busy ? <><span className="spin" />Connecting…</> : <><Icon name="link" />Connect your account</>}
            </button>
            {w.error ? <span className="ferr"><Icon name="error" />{w.error}</span> : null}
            <Link to="/verify" className="linkbtn accent">Just checking a medicine?<Icon name="arrow_forward" /></Link>
          </>
        )}

        {w.account && w.wrongNetwork && (
          <>
            <h1>Wrong network!</h1>
            <p className="lead">Your wallet is on {current}. MedTrace lives on the {w.network?.name || "test network"}.</p>
            <div className="netswap">
              <span className="netpill bad"><Icon name="public" />{current}</span>
              <Icon name="arrow_forward" size={30} />
              <span className="netpill good"><Icon name="science" />{w.network?.name || "test network"}</span>
            </div>
            <button className="btn lg block" onClick={w.switchNetwork}><Icon name="sync_alt" />Switch network</button>
            <span className="ink2" style={{ fontSize: 15 }}>Nothing was saved or spent.</span>
          </>
        )}

        {connected && (
          <>
            <div className="flabel" style={{ fontSize: 20, color: "var(--safe-ink)" }}>You're in!</div>
            <div className="youre">
              <div className="tile s64" style={{ background: ROLE_COLORS[w.role] }}><Icon name={ROLE_ICONS[w.role]} /></div>
              <div>
                <div style={{ fontFamily: "var(--display)", fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{w.name || ROLE_LABELS[w.role]}</div>
                <div className="ink2" style={{ fontSize: 18, fontWeight: 800 }}>{ROLE_LABELS[w.role]}</div>
              </div>
            </div>
            {w.role !== "sensor" ? (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="progress"><div /></div>
                <span className="ink2" style={{ fontSize: 16, fontWeight: 800 }}>Taking you to your batches… <Link to={ROLE_HOME[w.role]} className="linkbtn accent" style={{ fontSize: 16 }}>Go now</Link></span>
              </div>
            ) : <span className="ink2">Sensor accounts post readings from the simulator. There's no page for them here.</span>}
          </>
        )}

        {w.account && !w.wrongNetwork && !w.role && (
          <>
            <h1>Hmm, who's this?</h1>
            <p className="lead">This account has no role yet. Ask your MedTrace admin to add it, then come back.</p>
            <span className="acct-pill">
              <Icon name="badge" />Account <span className="mono">{shortAddr(w.account)}</span>
              <button className="linkbtn accent" style={{ fontSize: 15 }} onClick={() => { navigator.clipboard?.writeText(w.account); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>
            </span>
            <button className="btn lg block" onClick={async () => { await window.ethereum?.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] }).catch(() => {}); w.connect(); }}><Icon name="swap_horiz" />Try a different account</button>
            <Link to="/verify" className="linkbtn accent">Verify a medicine instead</Link>
          </>
        )}
      </div>
    </main>
  );
}
