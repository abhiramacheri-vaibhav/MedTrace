import { useMemo, useState } from "react";
import BatchCard from "../components/BatchCard.jsx";
import Empty from "../components/Empty.jsx";
import HandOffDialog from "../components/HandOffDialog.jsx";
import Icon from "../components/Icon.jsx";
import PageHero from "../components/PageHero.jsx";
import Rail from "../components/Rail.jsx";
import { LiveTrack } from "../components/Track.jsx";
import TxButton from "../components/TxButton.jsx";
import { useWallet } from "../lib/wallet.jsx";
import { useBatches } from "./useBatches.js";
import { ROLE_COLORS, isCid, shortAddr, shortName } from "../lib/contract.js";

export default function Factory() {
  const w = useWallet();
  const { batches, loading, reload, tick } = useBatches(w.reader);
  const [handoff, setHandoff] = useState(null);
  const [arenaId, setArenaId] = useState(null);
  const [sent, setSent] = useState([]);
  const me = w.account?.toLowerCase();
  const mine = useMemo(() => batches.filter((b) => b.currentHolder?.toLowerCase() === me && b.status !== 3 && b.status !== 4).sort((a, b) => b.id - a.id), [batches, me]);
  const inStock = mine.filter((b) => b.status !== 1);
  const onRoad = mine.filter((b) => b.status === 1);
  const arena = mine.find((b) => b.id === arenaId) || inStock[0] || mine[0] || null;
  const firstDist = Object.values(w.participants).find((p) => p.role === "distributor");
  const label = (a) => w.who(a)?.name || shortAddr(a);
  const startHandoff = (b) => { setArenaId(b.id); setHandoff({ batch: b, to: firstDist?.address }); };
  // Keep the truck parked halfway while the wallet confirms, and until the record catches up.
  const holdHalf = !!arena && arena.status !== 1 && ((handoff && handoff.batch.id === arena.id) || sent.includes(arena.id));

  return (
    <main className="page">
      <PageHero color={ROLE_COLORS.manufacturer} title={`Hey, ${w.name || "Factory"}!`} sub="Make a batch, then drag it to a distributor."
        stats={[{ icon: "inventory_2", col: ROLE_COLORS.manufacturer, n: inStock.length, label: "in stock" }, { icon: "local_shipping", col: "#FFB020", n: onRoad.length, label: "on the road" }]} />
      <div className="cols">
        <RegisterForm onDone={reload} />
        <div className="stack24">
          {loading && !batches.length ? <Empty mood="wait" color={ROLE_COLORS.manufacturer} title="Loading your batches…" text="Reading the shared record." /> : null}
          {!loading && !mine.length ? <Empty big mood="sleep" color={ROLE_COLORS.manufacturer} title="No batches yet" text="Make your first one with the form." arrow="arrow_back" /> : null}
          {arena ? (
            <div className="box arena">
              <div className="arena-head">
                <div className="row" style={{ gap: 10 }}>
                  <span className="h-sec">Hand-off</span>
                  {mine.length > 1 ? (
                    <select className="chip-select" value={arena.id} onChange={(e) => setArenaId(Number(e.target.value))} aria-label="Batch shown on the road">
                      {mine.map((b) => <option key={b.id} value={b.id}>{b.productName} · {b.lotNumber}</option>)}
                    </select>
                  ) : <span className="chip">{arena.productName} · {arena.lotNumber}</span>}
                </div>
                <span className="arena-hint"><Icon name="pan_tool" />{arena.status === 1 ? `Sent! Now ${shortName(label(arena.pendingHolder))} accepts it.` : `Drag the box to ${shortName(firstDist?.name || "a distributor")}`}</span>
              </div>
              <LiveTrack batch={arena} refreshKey={tick} size="full" draggable={arena.status !== 1} holdHalf={holdHalf} nextName={firstDist?.name} onDragHandoff={() => startHandoff(arena)} />
            </div>
          ) : null}
          {mine.length ? (
            <Rail title="Your batches" count={mine.length}>
              {mine.map((b) => (
                <BatchCard key={b.id} batch={b} refreshKey={tick}
                  badge={b.status === 1 ? "On the road" : ""} badgeKind="wait"
                  note={b.status === 1 ? `Waiting for ${shortName(label(b.pendingHolder))} to accept` : ""} noteKind="wait"
                  actions={b.status === 1 ? null : <button className="btn sm" onClick={() => startHandoff(b)}><Icon name="local_shipping" fill />Hand off to…</button>} />
              ))}
            </Rail>
          ) : null}
        </div>
      </div>
      {handoff ? <HandOffDialog batch={handoff.batch} initialTo={handoff.to} open onClose={() => setHandoff(null)} onDone={() => { setSent((s) => [...s, handoff.batch.id]); reload(); }} /> : null}
    </main>
  );
}

const MIN_T = -20, MAX_T = 40;
const PRESETS = [
  { label: "Fridge", lo: 2, hi: 8, icon: "kitchen" },
  { label: "Room", lo: 15, hi: 25, icon: "home" },
  { label: "Freezer", lo: -20, hi: -10, icon: "ac_unit" },
];
const fmt = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);

function RegisterForm({ onDone }) {
  const w = useWallet();
  const blank = { productName: "", lotNumber: "", expiry: "", lo: 2, hi: 8, coa: "" };
  const [f, setF] = useState(blank);
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const tempErr = !(f.lo < f.hi);
  const expiryErr = f.expiry && new Date(f.expiry).getTime() <= Date.now();
  // The certificate is optional. Accept a bare CID or a gateway link ("…/ipfs/<cid>").
  const coaCid = f.coa.trim().replace(/^.*\/ipfs\//, "").replace(/[/?#].*$/, "");
  const coaErr = coaCid !== "" && !isCid(coaCid);
  const ready = f.productName.trim() && f.lotNumber.trim() && f.expiry && !tempErr && !expiryErr && !coaErr;
  const at = (v) => ((v - MIN_T) / (MAX_T - MIN_T)) * 100;

  return (
    <div className="box form-stack">
      <div className="box-head"><div className="tile s44" style={{ background: ROLE_COLORS.manufacturer }}><Icon name="add" /></div><h2>New batch</h2></div>
      <div className="frow"><div className="ficon" style={{ background: "#5B4CF5" }}><Icon name="pill" /></div><label>Product name<input value={f.productName} onChange={set("productName")} placeholder="e.g. Amoxicillin 500 mg" /></label></div>
      <div className="frow"><div className="ficon" style={{ background: "#FF6FA8" }}><Icon name="tag" /></div><label>Lot number<input value={f.lotNumber} onChange={set("lotNumber")} placeholder="e.g. A-2291" /></label></div>
      <div className={`frow ${expiryErr && touched ? "err" : ""}`}><div className="ficon" style={{ background: "#22C08F" }}><Icon name="event" /></div><label>Expiry date<input type="date" value={f.expiry} onChange={set("expiry")} onBlur={() => setTouched(true)} /></label></div>
      {expiryErr && touched ? <span className="ferr"><Icon name="error" />Pick a date in the future.</span> : null}
      <div className={`temp-box ${tempErr ? "err" : ""}`}>
        <span className="cap">Safe temperature</span>
        <div className="temp-row">
          <span className="tchip cold"><Icon name="ac_unit" />{fmt(f.lo)} °C</span>
          <div className="dual">
            <div className="dual-track" />
            <div className="dual-fill" style={{ left: `${at(Math.min(f.lo, f.hi))}%`, right: `${100 - at(Math.max(f.lo, f.hi))}%`, background: tempErr ? "var(--danger)" : "var(--primary)" }} />
            <input type="range" min={MIN_T} max={MAX_T} step={0.5} value={f.lo} onChange={(e) => setF({ ...f, lo: Number(e.target.value) })} aria-label="Lowest safe temperature" />
            <input type="range" min={MIN_T} max={MAX_T} step={0.5} value={f.hi} onChange={(e) => setF({ ...f, hi: Number(e.target.value) })} aria-label="Highest safe temperature" />
          </div>
          <span className="tchip hot">{fmt(f.hi)} °C<Icon name="sunny" /></span>
        </div>
        <div className="presets">
          {PRESETS.map((p) => <button type="button" key={p.label} className={`preset ${f.lo === p.lo && f.hi === p.hi ? "on" : ""}`} onClick={() => setF({ ...f, lo: p.lo, hi: p.hi })}><Icon name={p.icon} />{p.label}</button>)}
        </div>
        {tempErr ? <span className="ferr"><Icon name="error" />Hot is lower than cold. Swap them.</span> : null}
      </div>
      <div className={`frow ${coaErr ? "err" : ""}`}><div className="ficon" style={{ background: "#3DA5FF" }}><Icon name="description" /></div><label>Certificate of analysis <span className="ink2" style={{ fontWeight: 600 }}>(optional)</span><input value={f.coa} onChange={set("coa")} placeholder="IPFS link or CID, e.g. bafkrei…" /></label></div>
      {coaErr ? <span className="ferr"><Icon name="error" />That doesn't look like an IPFS CID.</span> : null}
      <TxButton className="btn lg block" icon="add_box" disabled={!ready}
        send={() => w.writer.registerBatch(f.productName.trim(), f.lotNumber.trim(), Math.floor(new Date(f.expiry).getTime() / 1000), Math.round(f.lo * 10), Math.round(f.hi * 10), coaCid)}
        success="Batch registered!" successBody={`${f.productName} · ${f.lotNumber} is ready to hand off.`} failTitle="Couldn't register it"
        onDone={() => { setF(blank); setTouched(false); onDone(); }}>
        Register batch
      </TxButton>
    </div>
  );
}
