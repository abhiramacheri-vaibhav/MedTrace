// Patient "Verify my medicine" page. Owner: Vaibhav Abhiramacheri.
//
// The shell below matches the design (form card, "where to find the number" card). What's left to build:
//   1. On Check: call reader.verifyBatch(id) -> { exists, safeToUse, status, holder }, plus getBatch + getHistory.
//      Note: the design searches by LOT number; the contract keys by batch id until Maulik adds lot lookup.
//      Start with the numeric batch id and switch to lot once getBatchByLot lands.
//   2. Verdict block (classes .verdict.safe / .verdict.danger, see styles.css): big "Safe to use" / "Do not use",
//      then the reason in plain words: not found (neutral, NOT red) / recalled (reason word for word from the
//      history's Recalled entry) / temperature alert (reading from loadTempAlerts) / not certified / expired.
//   3. Under it, a card with product, lot, expiry, "Made by <factory>", then <Timeline size="full" /> and a Details row.
//      Use the .follow class on that card so it animates 100 ms after the verdict.
//   4. Listen to reader.on("BatchRecalled") and reader.on("TempAlert") for the shown batch so the page flips live.
//   5. Mobile: below 600px wide use <Timeline size="mini" /> and stack the input and button.
// Everything you need is already in lib/contract.js and components/. No wallet connection is required here.
import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { useWallet } from "../lib/wallet.jsx";

export default function Verify() {
  const { reader } = useWallet();
  const [q, setQ] = useState("");
  return (
    <main className="page w1040" style={{ gap: 20 }}>
      <div className="page-head"><h1 style={{ fontSize: 40 }}>Verify my medicine</h1><p className="lead">Type the batch number from the box to check it's safe to use.</p></div>
      <div className="card tight" style={{ gap: 10 }}>
        <label style={{ fontWeight: 600 }}>Batch number</label>
        <div className="row" style={{ gap: 12, flexWrap: "nowrap" }}>
          <input className="lg" placeholder="e.g. A-2291" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn h56" disabled title="This page is being built"><Icon name="search" />Check</button>
        </div>
        <div className="help">It's printed next to “Lot” on the box, e.g. A-2291.</div>
      </div>
      <div className="card tight">
        <div style={{ fontSize: 17, fontWeight: 700 }}>Where to find the batch number</div>
        <div style={{ height: 180, borderRadius: 8, background: "repeating-linear-gradient(135deg,#F1F1EE 0 10px,#F7F7F4 10px 20px)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink2)", fontSize: 14, textAlign: "center", padding: "0 16px" }}>Photo coming: side of a medicine box, lot number circled</div>
        <div className="ink2">Look on the side of the box or the back of the blister pack. It may say “Lot”, “LOT” or “Batch”.</div>
      </div>
      <p className="help dev-only">This page is being built. {reader ? "The contract connection is ready." : ""}</p>
    </main>
  );
}
