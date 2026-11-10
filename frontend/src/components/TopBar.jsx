import { NavLink } from "react-router-dom";
import { useWallet } from "../lib/wallet.jsx";
import { ROLE_LABELS, shortAddr } from "../lib/contract.js";

export default function TopBar() {
  const { account, role, name, disconnect, config } = useWallet();
  const network = config?.network === "amoy" ? "Polygon test network" : config?.network === "localhost" ? "local test network" : "not configured";
  return (
    <header className="topbar">
      <NavLink to="/" className="brand"><span className="dot" /> MedTrace</NavLink>
      <span className="chip">{network}</span>
      <span className="spacer" />
      <nav>
        <NavLink to="/verify">Verify my medicine</NavLink>
        {role && <NavLink to={roleHome(role)}>My page</NavLink>}
      </nav>
      {account ? (
        <span className="row small">
          <span>
            <b>{name || ROLE_LABELS[role] || "No role yet"}</b>
            <span className="muted"> · {ROLE_LABELS[role] || shortAddr(account)}</span>
          </span>
          <button className="btn secondary" style={{ minHeight: 34 }} onClick={disconnect}>Disconnect</button>
        </span>
      ) : null}
    </header>
  );
}

function roleHome(role) {
  return { admin: "/admin", manufacturer: "/factory", distributor: "/distributor", pharmacy: "/pharmacy", regulator: "/regulator" }[role] || "/";
}
