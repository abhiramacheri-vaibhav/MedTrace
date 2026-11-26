// One document field: paste an IPFS link or CID, or (when an upload key is set) upload a file
// and the field fills in with its CID. Used for the factory's certificate of analysis and the
// regulator's certificate. Uploading is optional: without a key, only the paste box shows.
import { useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { ipfsUrl, isCid } from "../lib/contract.js";
import { UPLOAD_ACCEPT, isUploadConfigured, uploadDocument } from "../lib/ipfs.js";

/** Turns what the user typed into a bare CID: accepts a CID or a gateway link ("…/ipfs/<cid>"). */
export const cidFromInput = (value) => value.trim().replace(/^.*\/ipfs\//, "").replace(/[/?#].*$/, "");

/** True when the field holds something that isn't a CID (empty is fine: the document is optional). */
export const cidInputError = (value) => {
  const cid = cidFromInput(value);
  return cid !== "" && !isCid(cid);
};

export default function DocField({ label, value, onChange, onBusy, color = "#3DA5FF" }) {
  const pick = useRef(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [uploaded, setUploaded] = useState("");
  const canUpload = isUploadConfigured();
  const bad = cidInputError(value);
  const cid = cidFromInput(value);

  const setUploading = (on) => { setBusy(on); onBusy?.(on); };

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    if (!file) return;
    setProblem("");
    setUploaded("");
    setUploading(true);
    try {
      const newCid = await uploadDocument(file);
      onChange(newCid);
      setUploaded(file.name);
    } catch (err) {
      setProblem(err?.name === "UploadError" ? err.message : "The upload didn't work. Try again, or paste an IPFS link.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="docfield">
      <div className={`frow ${bad ? "err" : ""}`}>
        <div className="ficon" style={{ background: color }}><Icon name="description" /></div>
        <label>
          <span>{label} <span className="ink2" style={{ fontWeight: 600 }}>(optional)</span></span>
          <input value={value} disabled={busy} onChange={(e) => { setUploaded(""); setProblem(""); onChange(e.target.value); }}
            placeholder={canUpload ? "Upload a file, or paste an IPFS link" : "IPFS link or CID, e.g. bafkrei…"} />
        </label>
        {canUpload ? (
          <>
            <button type="button" className="btn white sm doc-up" disabled={busy} onClick={() => pick.current?.click()}>
              {busy ? <><span className="spin" />Uploading…</> : <><Icon name="upload_file" />Upload</>}
            </button>
            <input ref={pick} type="file" accept={UPLOAD_ACCEPT} hidden onChange={onFile} aria-label={`Upload ${label}`} />
          </>
        ) : null}
      </div>
      {bad ? <span className="ferr"><Icon name="error" />That doesn't look like an IPFS CID.</span> : null}
      {problem ? <span className="ferr"><Icon name="error" />{problem}</span> : null}
      {uploaded && isCid(cid) ? (
        <span className="doc-ok"><Icon name="check_circle" fill />Uploaded {uploaded}. <a className="doclink" href={ipfsUrl(cid)} target="_blank" rel="noreferrer">Open it<Icon name="open_in_new" /></a></span>
      ) : null}
      {canUpload && !uploaded && !problem && !bad ? <span className="doc-hint">PDF, image, JSON, CSV or text, up to 10 MB. Files on IPFS are public, so never upload patient details.</span> : null}
    </div>
  );
}
