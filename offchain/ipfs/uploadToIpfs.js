// IPFS helper (owner: Rohan Chandrashekar).
//
// Uploads a document (Certificate of Analysis, temperature log, shipping record)
// to IPFS through Pinata and returns its CID. Only the CID is stored on-chain
// (registerBatch / attachDocument / certifyBatch), which keeps gas low and keeps
// large or sensitive files off the public ledger.
//
// Needs in .env: PINATA_JWT (Pinata dashboard -> API Keys -> New Key, "pinFileToIPFS"
// and "pinJSONToIPFS" allowed; copy the JWT, not the API key/secret pair).
//
// From code:
//   const { uploadFile, uploadJson, gatewayUrl } = require("./offchain/ipfs/uploadToIpfs");
//   const cid = await uploadFile("docs/coa.pdf");
//
// From the command line (prints the CID and a gateway link):
//   node offchain/ipfs/uploadToIpfs.js <path/to/file>
//   node offchain/ipfs/uploadToIpfs.js --test        (only checks that PINATA_JWT works)
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const PINATA_API = (process.env.PINATA_API_URL || "https://api.pinata.cloud").replace(/\/+$/, "");
const GATEWAY = (process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud").replace(/\/+$/, "");
const TIMEOUT_MS = 60_000;

function authHeader() {
  const jwt = (process.env.PINATA_JWT || "").trim();
  if (!jwt) {
    throw new Error("PINATA_JWT is not set. Add your Pinata JWT to .env (see .env.example).");
  }
  return { Authorization: `Bearer ${jwt}` };
}

/** True when a Pinata JWT is configured (lets callers fall back gracefully). */
function isConfigured() {
  return (process.env.PINATA_JWT || "").trim() !== "";
}

/** POSTs to a Pinata endpoint and returns the parsed JSON, with readable errors. */
async function pinataRequest(endpoint, { method = "POST", body, headers = {} } = {}) {
  const allHeaders = { ...authHeader(), ...headers }; // throws a clear error if PINATA_JWT is missing
  let res;
  try {
    res = await fetch(`${PINATA_API}${endpoint}`, {
      method,
      body,
      headers: allHeaders,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`Could not reach Pinata (${endpoint}): ${err.message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    const hint = res.status === 401 || res.status === 403 ? " (check PINATA_JWT and the key's permissions)" : "";
    throw new Error(`Pinata ${endpoint} failed: HTTP ${res.status}${hint}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Pinata ${endpoint} returned something that is not JSON: ${text.slice(0, 300)}`);
  }
}

function cidFrom(response, endpoint) {
  if (!response || typeof response.IpfsHash !== "string" || response.IpfsHash === "") {
    throw new Error(`Pinata ${endpoint} response had no IpfsHash: ${JSON.stringify(response).slice(0, 300)}`);
  }
  return response.IpfsHash;
}

/**
 * Upload a file from disk to IPFS.
 * @param {string} filePath  Path to the PDF / JSON / CSV file.
 * @param {string} [name]    Label shown in the Pinata dashboard (defaults to the file name).
 * @returns {Promise<string>} The IPFS CID (e.g. "bafy..." or "Qm...").
 */
async function uploadFile(filePath, name) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`File not found: ${filePath}`);
  }
  const fileName = path.basename(resolved);

  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(resolved)]), fileName);
  form.append("pinataMetadata", JSON.stringify({ name: name || fileName }));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  // fetch sets the multipart Content-Type (with boundary) itself.
  const endpoint = "/pinning/pinFileToIPFS";
  return cidFrom(await pinataRequest(endpoint, { body: form }), endpoint);
}

/**
 * Upload a JavaScript object (e.g. a sensor log) as JSON.
 * @param {object} data
 * @param {string} name  Label shown in the Pinata dashboard.
 * @returns {Promise<string>} The IPFS CID.
 */
async function uploadJson(data, name) {
  const endpoint = "/pinning/pinJSONToIPFS";
  const body = JSON.stringify({
    pinataContent: data,
    pinataMetadata: { name: name || "medtrace.json" },
    pinataOptions: { cidVersion: 1 },
  });
  return cidFrom(
    await pinataRequest(endpoint, { body, headers: { "Content-Type": "application/json" } }),
    endpoint
  );
}

/** Checks that PINATA_JWT is accepted by Pinata. Resolves to true or throws. */
async function testAuthentication() {
  await pinataRequest("/data/testAuthentication", { method: "GET" });
  return true;
}

/**
 * Build a public gateway link so users can open a document in the browser.
 * @param {string} cid
 * @returns {string}
 */
function gatewayUrl(cid) {
  return `${GATEWAY}/ipfs/${cid}`;
}

module.exports = { uploadFile, uploadJson, gatewayUrl, testAuthentication, isConfigured };

// Command-line use: node offchain/ipfs/uploadToIpfs.js <file> | --test
if (require.main === module) {
  (async () => {
    const arg = process.argv[2];
    if (!arg) {
      console.log("Usage: node offchain/ipfs/uploadToIpfs.js <path/to/file>   (or --test)");
      process.exitCode = 1;
      return;
    }
    if (arg === "--test") {
      await testAuthentication();
      console.log("Pinata authentication OK.");
      return;
    }
    const cid = await uploadFile(arg);
    console.log(`CID:     ${cid}`);
    console.log(`Gateway: ${gatewayUrl(cid)}`);
  })().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
