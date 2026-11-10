// Patient "Is my medicine OK?" page. Owner: Vaibhav Abhiramacheri.
//
// The shell below matches the v2 design (left: Pip + batch number + Check it; right: where to find it).
// What's left to build:
//   1. On Check: reader.verifyBatch(id) -> { exists, safeToUse, status, holder }, plus getBatch + getHistory.
//      The design searches by LOT number; the contract keys by batch id until lot lookup lands.
//      Start with the numeric batch id and switch to lot once that function exists.
//   2. Verdict card that bounces in (use the .box class, background --safe-soft or --danger-soft):
//      Safe: <Pip mood="party" color="#18B26B" /> + <Confetti /> + "Safe to use!".
//      Do not use: <Pip mood="worried" color="#F0483E" /> + reason in plain words (recall reason word for word
//      from the history's Recalled entry; reading from loadTempAlerts for a temperature breach).
//      Not found: neutral, NOT red: <Pip mood="think" color="#8C8577" /> + "Can't find …".
//   3. Three fact tiles under the verdict (e.g. "2–8 °C all the way", "Certified", "From Tempe Pharmacy").
//   4. "Its journey" card with <LiveTrack batch={batch} size="full" /> (mini on phones) and a Details row.
//   5. Listen to reader.on("BatchRecalled") and reader.on("TempAlert") for the shown batch so the page flips live.
// Everything you need is in lib/contract.js and components/. No wallet connection is needed here.
import { useState } from "react";
import Icon from "../components/Icon.jsx";
import Pip from "../components/Pip.jsx";
import { useWallet } from "../lib/wallet.jsx";

const TIPS = [
  { icon: "package_2", col: "#FF8A3D", text: "Side of the box" },
  { icon: "medication", col: "#3DA5FF", text: "Back of the strip" },
  { icon: "tag", col: "#FF6FA8", text: "Says “Lot”" },
];

export default function Verify() {
  const { reader } = useWallet();
  const [q, setQ] = useState("");
  return (
    <main className="page narrow">
      <div className="verify">
        <div className="left">
          <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
            <Pip size={96} mood="happy" color="#FF6FA8" />
            <h1 style={{ fontSize: 46 }}>Is my medicine OK?</h1>
          </div>
          <div className="box form-stack" style={{ padding: 18, gap: 12 }}>
            <span className="flabel">Batch number</span>
            <div className="frow" style={{ height: 62 }}><div className="ficon" style={{ background: "#FF6FA8" }}><Icon name="tag" /></div><label style={{ fontSize: 0 }}><input style={{ fontFamily: "var(--display)", fontSize: 24, letterSpacing: "0.04em" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="A-2291" aria-label="Batch number" /></label></div>
            <button className="btn lg block" disabled title="This page is being built"><Icon name="search" />Check it</button>
            <span className="ink2 row" style={{ gap: 6, fontSize: 15 }}><Icon name="info" />Look for “Lot” on the box.</span>
          </div>
        </div>
        <div className="right">
          <div className="box form-stack" style={{ padding: 18, gap: 12 }}>
            <div className="photo-ph">Photo coming: side of a medicine box, lot number circled</div>
            <div className="tips">
              {TIPS.map((t) => <div key={t.text}><div className="tile s44 flat wig" style={{ background: t.col }}><span className="ic fill">{t.icon}</span></div>{t.text}</div>)}
            </div>
          </div>
          <p className="ink2 dev-only" style={{ fontSize: 15 }}>This page is being built. {reader ? "The contract connection is ready." : ""}</p>
        </div>
      </div>
    </main>
  );
}
