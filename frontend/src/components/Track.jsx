// The road: the custody timeline. One station tile per holder (role colour), a chunky road, and the
// batch as a token. Box when held, bouncing truck while a hand-off waits on the dashed half of the
// road, red block when recalled, green lock once dispensed. A flame marker sits where it got too warm.
// Stations come from the real history, so a batch with two distributors shows two stops.
// With `draggable`, the token can be dragged toward the next station to start a hand-off
// (Enter or Space does the same for keyboard users). The wallet still has to confirm.
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { useBatchHistory } from "../pages/useBatches.js";
import { ACTION, ROLE_COLORS, ROLE_ICONS, ROLE_LABELS, dayOf, isZero, rangeC, shortAddr, shortName, tempC, timelineState } from "../lib/contract.js";

const CF = {
  full: { padX: 70, padTop: 32, tile: 88, tileR: 24, tileIcon: 46, roadY: 140, roadH: 22, tokenH: 52, tokenPad: 16, tokenFont: 18, tokenIcon: 24, labelsTop: 172, h: 222, labelW: 200, nameFont: 18, bubbleW: 250, bubblePad: "8px 12px", bubbleFont: 17, bubbleIcon: 20, alertS: 38, alertIcon: 22, badge: 30, badgeOff: 10, badgeIcon: 18, hintTop: 86, hintX: 62 },
  compact: { padX: 44, padTop: 12, tile: 54, tileR: 16, tileIcon: 30, roadY: 92, roadH: 16, tokenH: 38, tokenPad: 12, tokenFont: 15, tokenIcon: 19, labelsTop: 116, h: 142, labelW: 124, nameFont: 15, bubbleW: 200, bubblePad: "6px 10px", bubbleFont: 14, bubbleIcon: 16, alertS: 30, alertIcon: 18, badge: 22, badgeOff: 8, badgeIcon: 14, hintTop: 46, hintX: 34 },
  mini: { padX: 28, padTop: 0, tile: 40, tileR: 12, tileIcon: 22, roadY: 66, roadH: 12, tokenH: 30, tokenPad: 9, tokenFont: 13, tokenIcon: 16, labelsTop: 86, h: 108, labelW: 74, nameFont: 14, bubbleW: 160, bubblePad: "4px 8px", bubbleFont: 13, bubbleIcon: 14, alertS: 24, alertIcon: 15, badge: 18, badgeOff: 7, badgeIcon: 12, hintTop: 30, hintX: 24 },
};
const TOKENS = {
  held: { bg: "#FFFFFF", fg: "var(--ink)", icon: "inventory_2" },
  transit: { bg: "var(--wait)", fg: "var(--ink)", icon: "local_shipping" },
  recalled: { bg: "var(--danger)", fg: "#FFFFFF", icon: "block" },
  alert: { bg: "var(--danger-soft)", fg: "var(--danger-ink)", icon: "thermostat" },
  dispensed: { bg: "var(--safe)", fg: "#FFFFFF", icon: "lock" },
};
const stampDate = (prefix, t) => (t ? `${prefix} ${dayOf(t)}` : prefix);

export default function Track({ batch, history = [], who, size = "full", alerts = [], draggable = false, holdHalf = false, nextName = "", onDragHandoff }) {
  const c = CF[size] || CF.full;
  const state = timelineState(batch);
  const label = (a) => who?.(a)?.name || shortAddr(a);
  const roleOf = (a) => who?.(a)?.role;

  // Stations: factory, every receiver that accepted, the current holder if history hasn't caught up yet,
  // a waiting receiver, placeholders so the road always shows where it's headed, then the patient.
  const stops = [{ addr: batch.manufacturer, role: "manufacturer", date: history.find((h) => h.action === ACTION.Registered)?.timestamp || batch.manufactureDate, kind: "reached" }];
  for (const h of history) if (h.action === ACTION.ReceiptConfirmed) stops.push({ addr: h.actor, role: roleOf(h.actor) || "distributor", date: h.timestamp, kind: "reached" });
  const dispensed = batch.status === 3;
  if (!dispensed && batch.currentHolder && !stops.some((s) => s.addr?.toLowerCase() === batch.currentHolder.toLowerCase())) {
    stops.push({ addr: batch.currentHolder, role: roleOf(batch.currentHolder) || "distributor", kind: "reached" });
  }
  const waiting = batch.status === 1 && !isZero(batch.pendingHolder);
  if (waiting) stops.push({ addr: batch.pendingHolder, role: roleOf(batch.pendingHolder) || "distributor", kind: "pending" });
  while (!dispensed && stops.length < 3) stops.push({ placeholder: true, role: stops.length === 1 ? "distributor" : "pharmacy", kind: "future" });
  stops.push({ patient: true, role: "patient", kind: dispensed ? "reached" : "future", date: history.find((h) => h.action === ACTION.Dispensed)?.timestamp });

  const n = stops.length;
  const pct = (v) => `${(v / (n - 1)) * 100}%`;
  const holderIdx = dispensed ? n - 1 : Math.max(0, stops.findIndex((s) => s.kind === "reached" && !s.patient && s.addr?.toLowerCase() === batch.currentHolder?.toLowerCase()));
  const basePos = waiting ? holderIdx + 0.5 : holderIdx;
  const recalled = state === "recalled";
  const halfHeld = holdHalf && !waiting && !dispensed && !recalled;
  const shown = halfHeld ? holderIdx + 0.5 : basePos;
  const sfl = Math.floor(shown);
  const moving = shown % 1 !== 0;

  const [drag, setDrag] = useState(null);
  const [driving, setDriving] = useState(false);
  const [pop, setPop] = useState(-1);
  const ready = history.length > 0;
  const prevPos = useRef(null);
  // When an accepted hand-off moves the token forward, drive it as a truck, then pop the station.
  useEffect(() => {
    if (!ready) return undefined;
    const before = prevPos.current;
    prevPos.current = basePos;
    if (before !== null && basePos > before && Number.isInteger(basePos)) {
      setDriving(true);
      const t1 = setTimeout(() => { setDriving(false); setPop(basePos); }, 700);
      const t2 = setTimeout(() => setPop(-1), 1400);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    return undefined;
  }, [basePos, ready]);

  const look = driving || halfHeld ? "transit" : state === "created" || state === "received" ? "held" : state;
  const tk = TOKENS[look] || TOKENS.held;

  // Where on the road did it get too warm? Walk the history to the first alert.
  let alertAt = null;
  if (batch.temperatureBreached) {
    let idx = 0, inTransit = false;
    for (const h of history) {
      if (h.action === ACTION.ReceiptConfirmed) { idx += 1; inTransit = false; }
      else if (h.action === ACTION.CustodyTransferred) inTransit = true;
      else if (h.action === ACTION.TemperatureAlert && alertAt === null) alertAt = inTransit ? idx + 0.5 : idx;
    }
    if (alertAt === null) alertAt = Math.max(0.5, shown - 0.5);
  }
  const reading = alerts[0]?.readingTenthsC;
  const between = (at) => (Number.isInteger(at) ? (at + 0.5 <= n - 1.5 ? at + 0.5 : at - 0.5) : at);

  // Speech bubble: only on the full-size road, and never mid-drive or mid-drag.
  let bb = null;
  if (size === "full" && drag === null && !driving) {
    const sent = [...history].reverse().find((h) => h.action === ACTION.CustodyTransferred);
    const recall = history.find((h) => h.action === ACTION.Recalled);
    const alertEntry = history.find((h) => h.action === ACTION.TemperatureAlert);
    if (halfHeld) bb = { at: shown, tone: "wait", icon: "hourglass_top", title: "Confirm in your wallet", sub: "Then it waits for them to accept." };
    else if (state === "transit") bb = { at: shown, tone: "wait", icon: "hourglass_top", title: `Waiting for ${shortName(label(batch.pendingHolder))}`, sub: sent ? `Sent ${dayOf(sent.timestamp)}. It moves once they accept.` : "It moves once they accept." };
    else if (recalled) bb = { at: Math.min(shown + 0.5, n - 1.5), tone: "danger", icon: "block", title: "Recalled!", sub: recall?.details || "" };
    else if (state === "alert") bb = { at: between(alertAt), tone: "danger", icon: "local_fire_department", title: reading !== undefined ? `Too warm: ${tempC(reading)}` : "It got too warm", sub: `Safe range ${rangeC(batch.minTempTenthsC, batch.maxTempTenthsC)}${alertEntry ? `. Seen ${dayOf(alertEntry.timestamp)}.` : "."}`, sensor: true };
    else if (dispensed) bb = { at: n - 1.5, tone: "safe", icon: "lock", title: "Locked", sub: "With the patient. No more hand-offs." };
  }

  const canDrag = draggable && !waiting && !halfHeld && !driving && !recalled && state !== "alert" && !dispensed && sfl < n - 2;
  const bodyRef = useRef(null);
  const onDown = (e) => { if (!canDrag) return; e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(shown); };
  const onMove = (e) => {
    if (drag === null || !bodyRef.current) return;
    const r = bodyRef.current.getBoundingClientRect();
    setDrag(Math.max(sfl, Math.min(sfl + 1, ((e.clientX - r.left) / r.width) * (n - 1))));
  };
  const onUp = () => {
    if (drag === null) return;
    const far = drag - sfl > 0.3;
    setDrag(null);
    if (far) onDragHandoff?.();
  };
  const tokPos = drag ?? shown;
  const lotText = size === "mini" ? batch.lotNumber : `Lot ${batch.lotNumber}`;
  const over = Math.round(c.tile * 0.5);
  const roadTop = c.roadY - c.roadH / 2;

  return (
    <div className={`trk trk-${size}`} style={{ padding: `${c.padTop}px ${c.padX}px 0` }} aria-label={`Custody road for lot ${batch.lotNumber}`}>
      <div ref={bodyRef} style={{ position: "relative", height: c.h }}>
        <div className="trk-road" style={{ left: -over, right: -over, top: roadTop, height: c.roadH, borderRadius: c.roadH }} />
        <div className="trk-fill" style={{ top: roadTop + 4, height: c.roadH - 8, borderRadius: c.roadH, width: pct(sfl), background: recalled ? "var(--danger)" : "var(--primary)" }} />
        <div className="trk-dash" style={{ top: roadTop + 4, height: c.roadH - 8, borderRadius: c.roadH, left: pct(sfl), width: moving ? pct(shown - sfl) : 0 }} />

        {stops.map((s, i) => {
          const reached = s.kind === "reached" && i <= sfl;
          const pending = s.kind === "pending" || (halfHeld && i === sfl + 1);
          const dead = recalled && i > sfl;
          const stoppedHere = recalled && i === sfl;
          const col = ROLE_COLORS[s.role] || "#8C8577";
          const name = s.patient ? "Patient" : s.placeholder ? (pending && nextName ? nextName : ROLE_LABELS[s.role]) : label(s.addr);
          const date = reached ? (s.patient ? stampDate("Given", s.date) : i === 0 ? stampDate("Made", s.date) : stampDate("Got it", s.date)) : pending ? "Needs to accept" : dead ? "Stopped" : "Not yet";
          const lit = reached || pending;
          return (
            <div key={i} style={{ display: "contents" }}>
              <div className="trk-stop" style={{ left: pct(i) }}>
                <div className={`trk-tile ${pending ? "ring" : ""} ${pop === i ? "pop" : ""}`} title={name}
                  style={{ width: c.tile, height: c.tile, borderRadius: c.tileR, background: reached ? (stoppedHere ? "var(--danger)" : col) : "#fff", color: reached ? "#fff" : pending ? col : "#B9AFA0", border: `2.5px ${lit ? "solid" : "dashed"} ${lit ? "var(--ink)" : "var(--sand-line)"}`, boxShadow: lit ? "3px 3px 0 var(--ink)" : "none" }}>
                  <Icon name={ROLE_ICONS[s.role] || "store"} size={c.tileIcon} />
                  {reached && !stoppedHere ? (
                    <span className="trk-check" style={{ right: -c.badgeOff, top: -c.badgeOff, width: c.badge, height: c.badge }}><Icon name="check" size={c.badgeIcon} /></span>
                  ) : null}
                </div>
              </div>
              <div className="trk-label" style={{ left: pct(i), top: c.labelsTop, width: c.labelW }}>
                <span className="nm" style={{ fontSize: c.nameFont, color: lit ? "var(--ink)" : "var(--ink3)" }}>{size === "mini" ? shortName(name) : name}</span>
                {size === "full" ? <span className={`dt ${pending ? "pending" : ""}`}>{date}</span> : null}
              </div>
            </div>
          );
        })}

        {batch.temperatureBreached && alertAt !== null ? (
          <div className="trk-alert" style={{ left: pct(alertAt), top: c.roadY, width: c.alertS, height: c.alertS }} title="Temperature alert"><Icon name="thermostat" fill size={c.alertIcon} /></div>
        ) : null}

        {bb ? (
          <div className={`trk-bubble ${bb.tone}`} style={{ left: pct(bb.at), top: c.roadY - c.tokenH / 2 - 6, maxWidth: `min(${c.bubbleW}px, calc(${100 / (n - 1)}% - ${c.tile}px - 16px))` }}>
            <div style={{ padding: c.bubblePad }}>
              <span className="bt" style={{ fontSize: c.bubbleFont }}><Icon name={bb.icon} fill size={c.bubbleIcon} />{bb.title}</span>
              {bb.sub ? <span className="bs">{bb.sub}</span> : null}
              {bb.sensor ? <span className="chip honest xs"><Icon name="sensors" />simulated sensor</span> : null}
            </div>
          </div>
        ) : null}

        {canDrag && drag === null && size !== "mini" ? (
          <div className="trk-hint" style={{ left: pct(shown), top: c.hintTop, transform: `translateX(${c.hintX}px)` }}>
            <div>Drag me to {nextName ? shortName(nextName) : "the next stop"}<Icon name="arrow_forward" /></div>
          </div>
        ) : null}

        <div className="trk-token" role={canDrag ? "button" : undefined} tabIndex={canDrag ? 0 : undefined} aria-label={canDrag ? `Hand off ${lotText}` : undefined}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onKeyDown={(e) => { if (canDrag && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onDragHandoff?.(); } }}
          style={{ left: pct(tokPos), top: c.roadY, height: c.tokenH, padding: `0 ${c.tokenPad}px`, fontSize: c.tokenFont, background: tk.bg, color: tk.fg,
            transform: `translate(-50%,-50%) scale(${drag !== null ? 1.1 : 1})`, boxShadow: drag !== null ? "6px 6px 0 var(--ink)" : "3px 3px 0 var(--ink)",
            cursor: canDrag ? (drag !== null ? "grabbing" : "grab") : "default", ...(drag !== null ? { transition: "transform 150ms ease-out" } : {}) }}>
          <Icon name={tk.icon} fill size={c.tokenIcon} className={look === "transit" ? "truck" : ""} />{lotText}
        </div>
      </div>
    </div>
  );
}

// Same road, fetching its own history and temperature readings.
export function LiveTrack({ batch, refreshKey, whoOverride, ...rest }) {
  const { reader, who } = useWallet();
  const { history, alerts } = useBatchHistory(reader, batch, refreshKey);
  return <Track batch={batch} history={history} alerts={alerts} who={whoOverride || who} {...rest} />;
}
