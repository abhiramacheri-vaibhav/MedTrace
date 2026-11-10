// Shared hook: load all batches once, re-load on demand after a transaction.
import { useCallback, useEffect, useState } from "react";
import { loadAllBatches, nameMap } from "../lib/contract.js";

export function useBatches(reader) {
  const [batches, setBatches] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!reader) return;
    let live = true;
    setLoading(true);
    (async () => {
      try {
        const all = await loadAllBatches(reader);
        const nm = await nameMap(reader, all.flatMap((b) => [b.manufacturer, b.currentHolder, b.pendingHolder]));
        if (live) { setBatches(all); setNames(nm); }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [reader, tick]);

  return { batches, names, loading, reload, tick };
}
