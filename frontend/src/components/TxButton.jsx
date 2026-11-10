// A button that sends a transaction and shows "Saving…" until the chain confirms.
import { useState } from "react";
import { friendlyError } from "../lib/contract.js";
import { useToast } from "./Toast.jsx";

export default function TxButton({ send, children, success = "Saved on the blockchain", onDone, className = "btn", confirm }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    try {
      const tx = await send();
      await tx.wait();
      toast.ok(success);
      onDone?.();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button className={className} disabled={busy} onClick={run}>
      {busy ? <><span className="spin" /> Saving…</> : children}
    </button>
  );
}
