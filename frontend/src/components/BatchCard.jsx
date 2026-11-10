// One batch as a chunky card: product tile, lot and expiry chips, safe temperature range, the mini
// road, an optional note, actions, and a collapsed Details row for the technical values.
// Only real readings are shown: the reading chip appears only when the sensor reported a breach.
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import Track from "./Track.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { useBatchHistory } from "../pages/useBatches.js";
import { ACTION_LABELS, monthYear, productLook, shortAddr, tempC, when } from "../lib/contract.js";

const NOTE_ICON = { info: "info", wait: "hourglass_top", safe: "check_circle", lock: "lock", danger: "local_fire_department" };
const BADGE_ICON = { new: "auto_awesome", alert: "priority_high", wait: "local_shipping", done: "celebration" };
const deg = (tenths) => { const v = tenths / 10; return Number.isInteger(v) ? `${v}` : v.toFixed(1); };

export default function BatchCard({ batch, actions, note, noteKind = "info", noteIcon, badge, badgeKind = "new", alertBorder = false, refreshKey }) {
  const { reader, who } = useWallet();
  const { history, alerts } = useBatchHistory(reader, batch, refreshKey);
  const [open, setOpen] = useState(false);
  const [slam, setSlam] = useState(false);
  const wasCertified = useRef(batch.certified);
  // The regulator's stamp slams down the moment a batch becomes certified.
  useEffect(() => {
    if (batch.certified && !wasCertified.current) {
      wasCertified.current = true;
      setSlam(true);
      const t = setTimeout(() => setSlam(false), 800);
      return () => clearTimeout(t);
    }
    wasCertified.current = batch.certified;
    return undefined;
  }, [batch.certified]);

  const look = productLook(batch.productName);
  const reading = alerts[0]?.readingTenthsC;
  const label = (a) => who(a)?.name || shortAddr(a);

  return (
    <article className={`bcard ${alertBorder ? "alert" : ""}`}>
      {badge ? <span className={`sticker ${badgeKind}`}><Icon name={BADGE_ICON[badgeKind] || "auto_awesome"} fill />{badge}</span> : null}
      {batch.certified ? <div className={`stamp ${slam ? "slam" : ""}`} title="Certified by the regulator"><Icon name="verified" /><span className="t">CERTIFIED</span></div> : null}
      <div className="bc-head" style={{ paddingRight: batch.certified ? 64 : 0 }}>
        <div className="ptile" style={{ background: look.color }}><Icon name={look.icon} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="bc-name">{batch.productName}</div>
          <div className="bc-chips">
            <span className="chip"><Icon name="tag" />{batch.lotNumber}</span>
            <span className="chip"><Icon name="event" />{monthYear(batch.expiryDate)}</span>
          </div>
        </div>
      </div>
      <div className="bc-temp" title={`Must stay between ${deg(batch.minTempTenthsC)} and ${deg(batch.maxTempTenthsC)} °C`}>
        <span className="cold"><Icon name="ac_unit" />{deg(batch.minTempTenthsC)}°</span>
        <div className="tbar"><div className="fill" />{reading !== undefined ? <div className="mark" style={{ left: reading > batch.maxTempTenthsC ? "100%" : "0%" }} /> : null}</div>
        <span className="hot">{deg(batch.maxTempTenthsC)}°<Icon name="sunny" fill /></span>
        {reading !== undefined ? <span className="tread bad">{tempC(reading)}</span> : <span className="tread">no alerts</span>}
      </div>
      <Track batch={batch} history={history} who={who} alerts={alerts} size="mini" />
      {note ? <div className={`note ${noteKind}`}><Icon name={noteIcon || NOTE_ICON[noteKind]} fill />{note}</div> : null}
      {actions ? <div className="bc-actions">{actions}</div> : null}
      <button className="bc-details" onClick={() => setOpen((o) => !o)} aria-expanded={open}><Icon name={open ? "expand_less" : "expand_more"} />Details</button>
      {open ? (
        <div className="dgrid">
          <span className="k">Batch id</span><span className="v">{batch.id}</span>
          <span className="k">Factory</span><span className="v">{batch.manufacturer}</span>
          <span className="k">Now with</span><span className="v">{batch.currentHolder}</span>
          <span className="k">History</span>
          <span className="v txt">{history.map((h, i) => <div key={i}>{ACTION_LABELS[h.action]} · {label(h.actor)} · {when(h.timestamp)}{h.details ? ` · ${h.details}` : ""}</div>)}</span>
        </div>
      ) : null}
    </article>
  );
}
