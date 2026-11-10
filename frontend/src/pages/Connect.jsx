import { Link } from "react-router-dom";
import { useWallet } from "../lib/wallet.jsx";
import { ROLE_HOME, ROLE_LABELS, shortAddr } from "../lib/contract.js";

export default function Connect() {
  const w = useWallet();
  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <h1>MedTrace</h1>
        <p className="muted" style={{ fontSize: 17 }}>
          Every hand-off of a medicine batch is signed into a shared record, so anyone can check where it has been.
        </p>

        {!w.account && (
          <>
            <button className="btn big" onClick={w.connect} disabled={w.busy} style={{ marginTop: 12 }}>
              {w.busy ? <><span className="spin" /> Connecting…</> : "Connect your account"}
            </button>
            <p className="help" style={{ marginTop: 12 }}>
              Factories, distributors, pharmacies and regulators sign in here.
              Patients don't need an account: <Link to="/verify">verify a medicine</Link> instead.
            </p>
            {w.error && <div className="notice error" style={{ marginTop: 16, textAlign: "left" }}>{w.error}</div>}
          </>
        )}

        {w.account && w.wrongNetwork && (
          <div className="notice warn" style={{ textAlign: "left" }}>
            <b>Your wallet is on a different network.</b> Switch it to the {w.config.network === "amoy" ? "Polygon Amoy test network" : "local Hardhat network"} (chain id {w.config.chainId}) and this page will update.
          </div>
        )}

        {w.account && !w.wrongNetwork && w.role && (
          <>
            <div className="notice ok" style={{ textAlign: "left" }}>
              Connected as <b>{w.name || ROLE_LABELS[w.role]}</b> ({ROLE_LABELS[w.role]}).
            </div>
            <Link className="btn big" to={ROLE_HOME[w.role]} style={{ marginTop: 16 }}>Go to my page</Link>
          </>
        )}

        {w.account && !w.wrongNetwork && !w.role && (
          <div className="notice info" style={{ textAlign: "left" }}>
            <b>This account has no role yet.</b> Ask the network operator to onboard <span className="mono">{shortAddr(w.account)}</span>,
            or switch to a different account in your wallet. You can still <Link to="/verify">verify a medicine</Link>.
          </div>
        )}
      </div>
    </main>
  );
}
