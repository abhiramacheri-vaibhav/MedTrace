// Browser uploads to IPFS through Pinata (owner: Rohan Chandrashekar).
//
//   if (isUploadConfigured()) {            // false: keep the paste-a-CID field only
//     const cid = await uploadDocument(file);   // file: from <input type="file" accept={UPLOAD_ACCEPT}>
//     ...pass cid to registerBatch / certifyBatch
//   }
//
// The key comes from VITE_PINATA_UPLOAD_JWT in frontend/.env. Vite copies it into the
// page, so anyone who opens a build made with it can read it. It must be a key that
// can ONLY upload (pinFileToIPFS), never the full PINATA_JWT from the root .env.
//
// Node scripts use offchain/ipfs/uploadToIpfs.js instead: it reads files from disk.
import { isCid } from "./contract.js";

const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const TIMEOUT_MS = 60_000;

export const MAX_UPLOAD_MB = 10;
export const UPLOAD_TYPES = ["pdf", "png", "jpg", "jpeg", "json", "csv", "txt"];
/** For <input type="file" accept={UPLOAD_ACCEPT}>. */
export const UPLOAD_ACCEPT = UPLOAD_TYPES.map((t) => `.${t}`).join(",");

const uploadKey = () => (import.meta.env.VITE_PINATA_UPLOAD_JWT || "").trim();

/** An upload problem whose message is safe to show to the user as it is. */
export class UploadError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "UploadError";
  }
}

/** True when an upload key is set, so the page can offer an upload button. */
export const isUploadConfigured = () => uploadKey() !== "";

/** Why this file can't be uploaded, in plain words, or "" if it is fine. */
export function uploadProblem(file) {
  if (!file) return "Choose a file first.";
  // By extension, because browsers leave file.type empty for some files (often .csv).
  const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
  if (!UPLOAD_TYPES.includes(ext)) return `That file type isn't supported. Use ${UPLOAD_TYPES.join(", ")}.`;
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `That file is too big. The limit is ${MAX_UPLOAD_MB} MB.`;
  return "";
}

function httpProblem(status) {
  if (status === 401 || status === 403) return "The upload key was rejected. Paste an IPFS link instead.";
  if (status === 413) return "That file is too big for the upload service.";
  if (status === 429) return "Too many uploads right now. Wait a minute and try again.";
  return `The upload service had a problem (${status}). Try again, or paste an IPFS link.`;
}

/**
 * Uploads a file to IPFS. The file becomes public, so never upload patient data.
 * @param {File} file
 * @returns {Promise<string>} The CID to store on-chain.
 * @throws {UploadError} With a message ready to show to the user.
 */
export async function uploadDocument(file) {
  if (!isUploadConfigured()) throw new UploadError("Uploads aren't set up here. Paste an IPFS link instead.");
  const problem = uploadProblem(file);
  if (problem) throw new UploadError(problem);

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("pinataMetadata", JSON.stringify({ name: file.name }));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  let res, body;
  try {
    // No Content-Type header: the browser sets it, with the multipart boundary.
    res = await fetch(PIN_FILE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${uploadKey()}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    body = await res.text();
  } catch (cause) {
    throw new UploadError(
      cause.name === "TimeoutError"
        ? "The upload took too long. Check your connection and try again."
        : "Couldn't reach the upload service. Check your connection and try again.",
      { cause }
    );
  }
  if (!res.ok) throw new UploadError(httpProblem(res.status), { cause: body.slice(0, 300) });

  // Only return something the app accepts as a CID: it ends up on-chain for good.
  let cid;
  try {
    cid = JSON.parse(body).IpfsHash;
  } catch {
    cid = undefined;
  }
  if (!isCid(cid)) throw new UploadError("The upload service sent an unexpected reply. Try again.", { cause: body.slice(0, 300) });
  return cid;
}
