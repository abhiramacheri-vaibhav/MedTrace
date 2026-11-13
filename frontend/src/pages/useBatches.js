// Shared hook: load all batches once, re-load on demand after a transaction.
import { useCallback, useEffect, useState } from "react";
import { loadAllBatches } from "../lib/contract.js";

export function useBatches(reader) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!reader) return;
    let live = true;
    setLoading(true);
    loadAllBatches(reader)
      .then((all) => live && setBatches(all))
      .catch((e) => console.warn("Could not load batches:", e?.shortMessage || e?.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [reader, tick]);

  return { batches, loading, reload, tick };
}

// History, temperature readings and IPFS documents for one batch; re-fetches when the batch changes.
import { loadDocuments, loadTempAlerts, normalizeHistory } from "../lib/contract.js";
export function useBatchHistory(reader, batch, refreshKey) {
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [documents, setDocuments] = useState([]);
  useEffect(() => {
    if (!reader || !batch) return;
    let live = true;
    Promise.all([
      reader.getHistory(batch.id),
      batch.temperatureBreached ? loadTempAlerts(batch.id) : [],
      loadDocuments(reader, batch.id).catch(() => []),
    ])
      .then(([h, a, d]) => { if (live) { setHistory(normalizeHistory(h)); setAlerts(a); setDocuments(d); } })
      .catch(() => {});
    return () => { live = false; };
  }, [reader, batch?.id, batch?.status, batch?.currentHolder, batch?.pendingHolder, batch?.temperatureBreached, batch?.certified, refreshKey]);
  return { history, alerts, documents };
}
