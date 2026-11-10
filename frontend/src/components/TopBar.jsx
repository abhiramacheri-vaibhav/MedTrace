import { NavLink } from "react-router-dom";
import Icon from "./Icon.jsx";
import Pip from "./Pip.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { ROLE_COLORS, ROLE_ICONS, ROLE_LABELS, shortAddr } from "../lib/contract.js";

export default function TopBar() {
  const { account, role, name, disconnect, connect, config } = useWallet();
  const net = config?.network === "amoy" ? "Polygon test network" : config?.network === "localhost" ? "local test network" : "test network";
  return (
    <header className="topbar">
      <div className="row" style={{ gap: 16 }}>
        <NavLink to="/" className="brand"><Pip size={48} bob={false} badge={false} />MedTrace</NavLink>
        <span className="chip honest"><Icon name="science" />{net}</span>
      </div>
      <div className="row" style={{ gap: 20 }}>
        <NavLink to="/verify" className={({ isActive }) => `verify-pill ${isActive ? "on" : ""}`}><span className="vp-ic wig"><Icon name="verified_user" /></span>Verify my medicine</NavLink>
        {account ? (
          <>
            <div className="who">
              <div className="tile s44 wig" style={{ background: ROLE_COLORS[role] || "#8C8577", boxShadow: "2px 2px 0 var(--ink)" }}><Icon name={ROLE_ICONS[role] || "person"} /></div>
              <div className="who-txt">
                <span className="org">{name || (role ? ROLE_LABELS[role] : shortAddr(account))}</span>
                <span className="role">{role ? ROLE_LABELS[role] : "No role yet"}</span>
              </div>
            </div>
            <button className="linkbtn" onClick={disconnect}><Icon name="logout" />Disconnect</button>
          </>
        ) : (
          <button className="linkbtn strong" onClick={connect}><Icon name="link" />Connect your account</button>
        )}
      </div>
    </header>
  );
}
