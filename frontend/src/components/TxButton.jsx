// Sends a transaction and shows "Saving…" until the chain confirms.
// On success: a success toast. On failure: an error toast that says nothing changed.
import { useState } from "react";
import Icon from "./Icon.jsx";
import { friendlyError } from "../lib/contract.js";
import { useToast } from "./Toast.jsx";

export default function TxButton({ send, children, icon, success, successBody, failTitle = "That didn't go through", onDone, className = "btn", disabled, title }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function run() {
    setBusy(true);
    try {
      const tx = await send();
      await tx.wait();
      toast.ok(success || "Saved", successBody);
      onDone?.();
    } catch (e) {
      toast.error(failTitle, `${friendlyError(e)} Nothing was changed.`, { label: "Try again", onClick: run });
    } finally {
      setBusy(false);
    }
  }
  return (
    <button className={`${className} ${busy ? "saving" : ""}`} disabled={disabled || busy} onClick={run} title={title}>
      {busy ? <><span className="spin" /> Saving…</> : <>{icon ? <Icon name={icon} /> : null}{children}</>}
    </button>
  );
}
