// Patient "Is my medicine OK?" verification page.
// Owner: Vaibhav Abhiramacheri.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Confetti from "../components/Confetti.jsx";
import Icon from "../components/Icon.jsx";
import Pip from "../components/Pip.jsx";
import { LiveTrack } from "../components/Track.jsx";
import {
  ACTION,
  dateOf,
  loadTempAlerts,
  normalizeBatch,
  normalizeHistory,
  rangeC,
  shortAddr,
  tempC,
} from "../lib/contract.js";
import { useWallet } from "../lib/wallet.jsx";

const TIPS = [
  { icon: "package_2", col: "#FF8A3D", text: "Side of the box" },
  { icon: "medication", col: "#3DA5FF", text: "Back of the strip" },
  { icon: "tag", col: "#FF6FA8", text: "Says “Lot”" },
];

export default function Verify() {
  const { reader, who } = useWallet();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("lot") || "");
  const [result, setResult] = useState(null);
  const [batch, setBatch] = useState(null);
  const [history, setHistory] = useState([]);
  const [tempAlerts, setTempAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadBatch = useCallback(
    async (batchId) => {
      if (!reader) return;

      const [verification, rawBatch, rawHistory] = await Promise.all([
        reader.verifyBatch(batchId),
        reader.getBatch(batchId),
        reader.getHistory(batchId),
      ]);

      const normalizedBatch = normalizeBatch(rawBatch);
      const normalizedHistory = normalizeHistory(rawHistory);

      setBatch(normalizedBatch);
      setHistory(normalizedHistory);

      if (normalizedBatch.temperatureBreached) {
        setTempAlerts(await loadTempAlerts(batchId));
      } else {
        setTempAlerts([]);
      }

      setResult({
        batchId: Number(batchId),
        exists: verification.exists,
        safeToUse: verification.safeToUse,
        status: Number(verification.status),
        holder: verification.holder,
      });
    },
    [reader]
  );

  const checkBatch = async (lotArg) => {
    const lotNumber = (typeof lotArg === "string" ? lotArg : q).trim();

    if (!reader || !lotNumber) return;

    setLoading(true);
    setError("");
    setResult(null);
    setBatch(null);
    setHistory([]);
    setTempAlerts([]);

    try {
      const batchIds = await reader.getBatchIdsByLot(lotNumber);

      if (batchIds.length === 0) {
        setResult({ exists: false });
        return;
      }

      const batchId = batchIds[batchIds.length - 1];

      await loadBatch(batchId);
    } catch (err) {
      console.error(err);
      setError("Could not check this batch. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Opened from a batch card ("/verify?lot=..."): check that lot straight away.
  const lotParam = params.get("lot");
  useEffect(() => {
    if (reader && lotParam) {
      setQ(lotParam);
      checkBatch(lotParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reader, lotParam]);

  useEffect(() => {
    if (!reader || !batch) return;

    const refreshBatch = (eventBatchId) => {
      if (Number(eventBatchId) !== batch.id) return;

      loadBatch(batch.id).catch((err) => {
        console.warn(
          "Could not refresh batch after blockchain event:",
          err?.shortMessage || err?.message
        );
      });
    };

    reader.on("BatchRecalled", refreshBatch);
    reader.on("TempAlert", refreshBatch);

    return () => {
      reader.off("BatchRecalled", refreshBatch);
      reader.off("TempAlert", refreshBatch);
    };
  }, [reader, batch?.id, loadBatch]);

  const recallEntry = history.find(
    (entry) => entry.action === ACTION.Recalled
  );

  const firstTempAlert = tempAlerts[0];

  let unsafeReason = "";

  if (batch) {
    if (batch.status === 4) {
      unsafeReason =
        recallEntry?.details || "This batch was recalled by the regulator.";
    } else if (batch.temperatureBreached) {
      unsafeReason = firstTempAlert
        ? `A temperature alert recorded ${tempC(firstTempAlert.readingTenthsC)}.`
        : "This batch went outside its safe temperature range.";
    } else if (!batch.certified) {
      unsafeReason =
        "This batch has not been certified by the regulator.";
    } else if (batch.expiryDate * 1000 <= Date.now()) {
      unsafeReason = `This batch expired on ${dateOf(batch.expiryDate)}.`;
    }
  }

  const holderName = batch
  ? who(batch.currentHolder)?.name || shortAddr(batch.currentHolder)
  : "";

  return (
    <main className="page narrow">
      <div className="verify">
        <div className="left">
          <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
            <Pip size={96} mood="happy" color="#FF6FA8" />
            <h1 style={{ fontSize: 46 }}>Is my medicine OK?</h1>
          </div>
          <div className="box form-stack" style={{ padding: 18, gap: 12 }}>
            <span className="flabel">Lot number</span>
            <div className="frow" style={{ height: 62 }}>
              <div className="ficon" style={{ background: "#FF6FA8" }}>
                <Icon name="tag" />
              </div>

              <label style={{ fontSize: 0 }}>
                <input
                  style={{
                    fontFamily: "var(--display)",
                    fontSize: 24,
                    letterSpacing: "0.04em",
                  }}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="A-2291"
                  aria-label="Lot number"
                />
              </label>
            </div>
            <button
              className="btn lg block"
              onClick={checkBatch}
              disabled={!reader || !q.trim() || loading}
            >
              <Icon name="search" />
              {loading ? "Checking…" : "Check it"}
            </button>
            {error && <div className="ink2">{error}</div>}
            <span className="ink2 row" style={{ gap: 6, fontSize: 15 }}>
              <Icon name="info" />
              Look for “Lot” on the box.
            </span>
          </div>
        </div>
        <div className="right">
          <div className="box form-stack" style={{ padding: 18, gap: 12 }}>
            <div className="photo-ph">
              Photo coming: side of a medicine box, lot number circled
            </div>
            <div className="tips">
              {TIPS.map((t) => (
                <div key={t.text}>
                  <div
                    className="tile s44 flat wig"
                    style={{ background: t.col }}
                  >
                    <span className="ic fill">{t.icon}</span>
                  </div>
                  {t.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {result?.exists && result.safeToUse && batch && (
        <div
          className="box"
          style={{
            marginTop: 24,
            padding: 24,
            background: "var(--safe-soft)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Confetti />

          <div className="row" style={{ gap: 18 }}>
            <Pip size={96} mood="party" color="#18B26B" />

            <div>
              <h2 style={{ fontSize: 34 }}>Safe to use!</h2>

              <p className="ink2" style={{ fontSize: 18 }}>
                {batch.productName} · Lot {batch.lotNumber}
              </p>
            </div>
          </div>
        </div>
      )}

      {result?.exists && !result.safeToUse && batch && (
        <div
          className="box"
          style={{
            marginTop: 24,
            padding: 24,
            background: "var(--danger-soft)",
          }}
        >
          <div className="row" style={{ gap: 18 }}>
            <Pip size={96} mood="worried" color="#F0483E" />

            <div>
              <h2 style={{ fontSize: 34 }}>Do not use</h2>

              <p style={{ fontSize: 18 }}>
                {unsafeReason}
              </p>

              <p className="ink2">
                {batch.productName} · Lot {batch.lotNumber}
              </p>
            </div>
          </div>
        </div>
      )}

      {result && !result.exists && (
        <div
          className="box"
          style={{
            marginTop: 24,
            padding: 24,
          }}
        >
          <div className="row" style={{ gap: 18 }}>
            <Pip size={96} mood="think" color="#8C8577" />

            <div>
              <h2 style={{ fontSize: 30 }}>Can't find this batch</h2>

              <p className="ink2" style={{ fontSize: 18 }}>
                Check the lot number on the medicine and try again.
              </p>
            </div>
          </div>
        </div>
      )}

      {result?.exists && batch && (
        <div className="ftiles" style={{ marginTop: 18 }}>
          <div className="ftile">
            <div
              className="tile flat"
              style={{ background: "#3DA5FF" }}
            >
              <Icon name="thermostat" />
            </div>

            <div className="stat-txt">
              <span className="l">
                {rangeC(batch.minTempTenthsC, batch.maxTempTenthsC)} safe range
              </span>
            </div>
          </div>

          <div className="ftile">
            <div
              className="tile flat"
              style={{ background: "#8B5CF6" }}
            >
              <Icon name="verified" />
            </div>

            <div className="stat-txt">
              <span className="l">
                {batch.certified ? "Regulator certified" : "Not certified"}
              </span>
            </div>
          </div>

          <div className="ftile">
            <div
              className="tile flat"
              style={{ background: "#22C08F" }}
            >
              <Icon name="inventory_2" />
            </div>

            <div className="stat-txt">
              <span className="l">
                {holderName ? `With ${holderName}` : "Holder unavailable"}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {result?.exists && batch && (
        <div
          className="box"
          style={{
            marginTop: 18,
            padding: 24,
          }}
        >
          <h2>Its journey</h2>

          <LiveTrack batch={batch} size="full" />

          <div className="dgrid" style={{ marginTop: 18 }}>
            <span className="k">Product</span>
            <span className="v">{batch.productName}</span>

            <span className="k">Lot</span>
            <span className="v">{batch.lotNumber}</span>

            <span className="k">Batch ID</span>
            <span className="v">{batch.id}</span>

            <span className="k">Expires</span>
            <span className="v">{dateOf(batch.expiryDate)}</span>

            <span className="k">Temperature</span>
            <span className="v">
              {batch.temperatureBreached
                ? "Alert recorded"
                : "No alerts recorded"}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
