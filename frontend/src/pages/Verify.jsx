// Patient "Verify my medicine" page. Owner: Vaibhav Abhiramacheri.
//
// What this page should do (see docs/interim-demo-tasks.md):
//   1. One input: the batch number printed on the box. No wallet needed.
//   2. Call reader.verifyBatch(id) -> { exists, safeToUse, status, holder }.
//   3. Show a big green "Safe to use" or red "Do not use" verdict (CSS classes .verdict.green / .verdict.red),
//      with the reason in plain words (not found / recalled / temperature alert / not certified / expired).
//   4. Below it, reuse <BatchCard> (timeline + collapsed details) so the custody journey is visible.
//   5. Listen to BatchRecalled / TempAlert events for the shown batch so the page flips live.
//
// Everything you need is already wired: useWallet().reader is a read-only contract handle that
// works without connecting a wallet. See lib/contract.js for normalizeBatch() and STATUS labels.
import { useWallet } from "../lib/wallet.jsx";

export default function Verify() {
  const { reader } = useWallet();
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <h1>Verify my medicine</h1>
      <p className="muted">Type the batch number printed on the box to see where it has been and whether it is safe to use.</p>
      <div className="card">
        <div className="field"><label>Batch number</label><input placeholder="e.g. 1" disabled /></div>
        <button className="btn big" disabled>Check this batch</button>
        <p className="help" style={{ marginTop: 12 }}>This page is being built. {reader ? "The contract connection is ready." : ""}</p>
      </div>
    </main>
  );
}
