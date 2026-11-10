// The custody timeline: the one visual that explains the two-step hand-off.
// Stops: factory, every receiver in order (accepted or waiting), then Patient. A "Next stop"
// placeholder fills the gap on a fresh batch. The token sits on the holder, or halfway while a
// hand-off waits. Sizes: full (pages), compact (rows, dialogs), mini (mobile).
import Icon from "./Icon.jsx";
import { ACTION, ROLE_ICONS, ROLE_LABELS, STATE_CHIP, isZero, rangeC, shortAddr, tempC, timelineState, when } from "../lib/contract.js";

const CFG = {
  full:    { padX: 110, h: 236, trackY: 116, tokenH: 44, tokenPad: 16, tokenFont: 16, tokenIcon: 20, labelW: 210, labelsTop: 152, dot: 26, dotIcon: 16, orgFont: 17, coFont: 17, coW: 400, coPad: "10px 14px" },
  compact: { padX: 72,  h: 138, trackY: 64,  tokenH: 34, tokenPad: 12, tokenFont: 15, tokenIcon: 18, labelW: 144, labelsTop: 92,  dot: 20, dotIcon: 13, orgFont: 15, coFont: 15, coW: 320, coPad: "6px 10px" },
  mini:    { padX: 44,  h: 148, trackY: 66,  tokenH: 32, tokenPad: 10, tokenFont: 14, tokenIcon: 16, labelW: 86,  labelsTop: 92,  dot: 18, dotIcon: 12, orgFont: 14, coFont: 14, coW: 230, coPad: "6px 10px" },
};
const TOKEN_ICON = { transit: "hourglass_top", recalled: "block", alert: "thermostat", dispensed: "lock" };

export default function Timeline({ batch, history = [], who, size = "full", alerts = [], showHead = true }) {
  const cfg = CFG[size] || CFG.full;
  const state = timelineState(batch);
  const label = (a) => who?.(a)?.name || shortAddr(a);
  const roleOf = (a) => who?.(a)?.role;

  // Build stops from history: factory first, then each accepted receiver, then a pending receiver.
  const stops = [{ addr: batch.manufacturer, role: "manufacturer", date: history.find((h) => h.action === ACTION.Registered)?.timestamp, kind: "reached" }];
  for (const h of history) if (h.action === ACTION.ReceiptConfirmed) stops.push({ addr: h.actor, role: roleOf(h.actor) || "distributor", date: h.timestamp, kind: "reached" });
  const waiting = batch.status === 1 && !isZero(batch.pendingHolder);
  if (waiting) stops.push({ addr: batch.pendingHolder, role: roleOf(batch.pendingHolder) || "distributor", kind: "pending" });
  const dispensed = batch.status === 3;
  if (stops.length < 3 && !dispensed) stops.push({ placeholder: true, kind: "future" });
  const dispensedAt = history.find((h) => h.action === ACTION.Dispensed)?.timestamp;
  stops.push({ patient: true, kind: dispensed ? "reached" : "future", date: dispensedAt });

  const n = stops.length;
  const pct = (i) => `${(i / (n - 1)) * 100}%`;
  const holderIdx = dispensed ? n - 1 : Math.max(0, stops.findIndex((s) => !s.placeholder && !s.patient && s.kind === "reached" && s.addr?.toLowerCase() === batch.currentHolder?.toLowerCase()));
  const pos = waiting ? holderIdx + 0.5 : holderIdx;
  const recalled = state === "recalled";
  const color = recalled ? "red" : "";

  // Where did the temperature breach happen? Walk history to find the holder index at that moment.
  let alertAt = null;
  if (batch.temperatureBreached) {
    let idx = 0, inTransit = false;
    for (const h of history) {
      if (h.action === ACTION.ReceiptConfirmed) { idx += 1; inTransit = false; }
      if (h.action === ACTION.CustodyTransferred) inTransit = true;
      if (h.action === ACTION.TemperatureAlert && alertAt === null) alertAt = inTransit ? idx + 0.5 : idx;
    }
    if (alertAt === null) alertAt = Math.max(0.5, pos - 0.5);
  }
  const reading = alerts[0]?.readingTenthsC;
  const alertEntry = history.find((h) => h.action === ACTION.TemperatureAlert);
  const recallEntry = history.find((h) => h.action === ACTION.Recalled);
  const sentEntry = [...history].reverse().find((h) => h.action === ACTION.CustodyTransferred);

  const nextName = waiting ? label(batch.pendingHolder) : "";
  const callouts = {
    transit: { tone: "wait", at: pos, title: `Waiting for ${nextName} to accept`, sub: `Sent ${when(sentEntry?.timestamp)}. It moves on when they accept.` },
    recalled: { tone: "danger", at: pos, title: "Recalled by the regulator", sub: recallEntry ? `${recallEntry.details || "No reason given"}. ${when(recallEntry.timestamp)}.` : "" },
    alert: { tone: "danger", at: alertAt ?? pos, title: reading !== undefined ? `Temperature reached ${tempC(reading)}` : "Temperature went out of range", sub: `Safe range is ${rangeC(batch.minTempTenthsC, batch.maxTempTenthsC)}.${alertEntry ? ` Recorded ${when(alertEntry.timestamp)}.` : ""}`, sensor: true },
    dispensed: { tone: "neutral", at: n - 1, title: "Record locked", sub: "Dispensed to a patient. No more hand-offs." },
  };
  const co = callouts[state];
  const frac = co ? co.at / (n - 1) : 0;
  const coTx = frac < 0.2 ? "-18%" : frac > 0.8 ? "-82%" : "-50%";
  const chip = STATE_CHIP[state];
  const chipText = state === "created" ? `Created · with ${label(batch.currentHolder)}` : state === "transit" ? `In transit · waiting for ${nextName}` : state === "received" ? `Received · with ${label(batch.currentHolder)}` : state === "dispensed" ? "Dispensed · record locked" : chip.text;

  return (
    <div className="tl" aria-label={`Custody timeline: ${chipText}`}>
      {showHead && size === "full" ? (
        <div className="tl-head">
          <span className="tl-kicker">Custody timeline</span>
          <span className="row" style={{ gap: 8 }}>
            {batch.certified ? <span className="chip accent"><Icon name="verified" fill />Certified by the regulator</span> : null}
            <span className={`chip ${chip.tone}`}><Icon name={chip.icon} fill />{chipText}</span>
          </span>
        </div>
      ) : null}
      <div style={{ padding: `0 ${cfg.padX}px` }}>
        <div className="tl-body" style={{ height: cfg.h }}>
          <div className="tl-base" style={{ top: cfg.trackY }} />
          <div className={`tl-solid ${color}`} style={{ top: cfg.trackY, width: pct(Math.floor(pos)) }} />
          <div className="tl-dash" style={{ top: cfg.trackY, left: pct(Math.floor(pos)), width: waiting ? pct(0.5) : 0, opacity: waiting ? 1 : 0 }} />
          {stops.map((s, i) => {
            const reached = s.kind === "reached" && i <= Math.floor(pos);
            const pending = s.kind === "pending";
            const name = s.patient ? "Patient" : s.placeholder ? "Next stop" : size === "mini" ? (label(s.addr).split(" ")[0]) : label(s.addr);
            const role = s.patient ? "Dispensed" : s.placeholder ? "" : ROLE_LABELS[s.role] || "";
            const icon = s.patient ? "person" : s.placeholder ? "more_horiz" : ROLE_ICONS[s.role] || "store";
            const dateText = reached ? (s.patient ? `Dispensed ${when(s.date)}` : i === 0 ? `Created ${when(s.date)}` : `Accepted ${when(s.date)}`) : pending ? "Waiting to accept" : s.placeholder ? "Not yet handed off" : "Not yet";
            return (
              <div key={i} style={{ display: "contents" }}>
                <div className={`tl-dot ${reached ? "reached" : ""} ${pending ? "pending" : ""} ${color}`} style={{ left: pct(i), top: cfg.trackY, width: cfg.dot, height: cfg.dot }}>
                  {reached ? <Icon name="check" size={cfg.dotIcon} /> : null}
                </div>
                <div className="tl-label" style={{ left: pct(i), top: cfg.labelsTop, width: cfg.labelW }}>
                  {size === "full" && role ? <span className="role"><Icon name={icon} />{role}</span> : null}
                  <span className={`org ${reached || pending ? "" : "future"}`} style={{ fontSize: cfg.orgFont }}>{name}</span>
                  {size === "mini" && role ? <span className="date">{role}</span> : null}
                  {size === "full" ? <span className={`date ${pending ? "pending" : ""}`}>{dateText}</span> : null}
                </div>
              </div>
            );
          })}
          {batch.temperatureBreached && alertAt !== null ? (
            <div className="tl-alert" style={{ left: pct(alertAt), top: cfg.trackY }} title="Temperature alert"><Icon name="priority_high" /></div>
          ) : null}
          {co ? (
            <div className={`tl-callout ${co.tone}`} style={{ left: pct(co.at), top: cfg.trackY - cfg.tokenH / 2 - 10, transform: `translate(${coTx}, -100%)`, maxWidth: cfg.coW }}>
              <div style={{ padding: cfg.coPad }}>
                <span className="ct" style={{ fontSize: cfg.coFont }}>{co.title}</span>
                {size === "full" && co.sub ? <span className="cs">{co.sub}</span> : null}
                {size === "full" && co.sensor ? <span className="chip xs honest" style={{ alignSelf: "flex-start", marginTop: 4 }}><Icon name="sensors" />simulated sensor</span> : null}
              </div>
            </div>
          ) : null}
          <div className={`tl-token ${state}`} style={{ left: pct(pos), top: cfg.trackY, height: cfg.tokenH, padding: `0 ${cfg.tokenPad}px`, fontSize: cfg.tokenFont }} title={chipText}>
            <Icon name={TOKEN_ICON[state] || "medication"} fill size={cfg.tokenIcon} />{size === "mini" ? batch.lotNumber : `Lot ${batch.lotNumber}`}
          </div>
        </div>
      </div>
    </div>
  );
}
