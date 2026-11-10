import { NavLink } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { ROLE_ICONS, ROLE_LABELS, shortAddr } from "../lib/contract.js";

export default function TopBar() {
  const { account, role, name, disconnect, connect, config } = useWallet();
  const net = config?.network === "amoy" ? "Polygon test network" : config?.network === "localhost" ? "local test network" : "test network";
  return (
    <header className="topbar">
      <div className="left">
        <NavLink to="/" className="brand"><span className="logo"><Icon name="medication" fill /></span>MedTrace</NavLink>
        <span className="chip sm honest"><Icon name="science" />{net}</span>
      </div>
      <div className="right">
        <NavLink to="/verify" className={({ isActive }) => `topnav ${isActive ? "active" : ""}`}><Icon name="verified_user" />Verify my medicine</NavLink>
        <span className="vdiv" />
        {account ? (
          <>
            <div className="who">
              <div className="avatar"><Icon name={ROLE_ICONS[role] || "person"} /></div>
              <div className="lines">
                <span className="org">{name || (role ? ROLE_LABELS[role] : shortAddr(account))}</span>
                <span className="role">{role ? ROLE_LABELS[role] : "No role yet"}</span>
              </div>
            </div>
            <button className="linkbtn" onClick={disconnect}><Icon name="logout" />Disconnect</button>
          </>
        ) : (
          <button className="linkbtn" style={{ color: "var(--ink)", fontWeight: 600 }} onClick={connect}><Icon name="link" />Connect your account</button>
        )}
      </div>
    </header>
  );
}
