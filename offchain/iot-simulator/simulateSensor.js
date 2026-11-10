// Simulated IoT temperature sensor (owner: Rohan Chandrashekar).
//
// What it does:
//   1. Generates a temperature reading for a batch every few seconds
//      (mostly normal, with an occasional spike to simulate a cold-chain failure).
//   2. Keeps every reading OFF-chain in a log (cheap).
//   3. When a reading leaves the batch's allowed range, it uploads the log to IPFS
//      (offchain/ipfs/uploadToIpfs.js) and calls MedTrace.recordTemperatureAlert()
//      from the SENSOR_ROLE wallet with the log's CID (on-chain).
//
// Usage:
//   BATCH_ID=1 npm run iot:simulate
//   BATCH_ID=1 node offchain/iot-simulator/simulateSensor.js
//
// Needs in .env:
//   CONTRACT_ADDRESS    MedTrace address (deployments/<network>.json)
//   SENSOR_PRIVATE_KEY  wallet that has SENSOR_ROLE on that contract
//   RPC_URL             defaults to the local Hardhat node; use the Amoy RPC for the testnet
//   PINATA_JWT          optional; without it the alert is still recorded, with no log CID
//
// Optional settings (environment variables):
//   BATCH_ID      batch to monitor (default 1)
//   MAX_ALERTS    stop after this many on-chain alerts (default 1; 0 = run until Ctrl+C)
//   INTERVAL_MS   time between readings (default 3000)
//   SPIKE_CHANCE  share of readings that are out of range, 0..1 (default 0.1)
require("dotenv").config();
const { ethers } = require("ethers");
const { uploadJson, gatewayUrl, isConfigured: ipfsConfigured } = require("../ipfs/uploadToIpfs");

const RPC_URL = (process.env.RPC_URL || "http://127.0.0.1:8545").trim();
const BATCH_ID = BigInt(process.env.BATCH_ID || 1);
const MAX_ALERTS = Number(process.env.MAX_ALERTS ?? 1);
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 3000);
const SPIKE_CHANCE = Number(process.env.SPIKE_CHANCE ?? 0.1);

const AMOY_CHAIN_ID = 80002n;
const AMOY_MIN_TIP = 30_000_000_000n; // 30 gwei; Amoy rejects or stalls txs tipping under ~25 gwei
const STATUS_NAMES = ["Created", "InTransit", "Received", "Dispensed", "Recalled"];

// Minimal ABI: only the functions the sensor needs.
const ABI = [
  "function getBatch(uint256) view returns (tuple(uint256 id,string productName,string lotNumber,address manufacturer,address currentHolder,address pendingHolder,uint64 manufactureDate,uint64 expiryDate,int16 minTempTenthsC,int16 maxTempTenthsC,uint8 status,bool certified,bool temperatureBreached))",
  "function recordTemperatureAlert(uint256 batchId, int16 readingTenthsC, string logCid)",
  "function SENSOR_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
];

/** Returns a reading in tenths of a degree C (e.g. 54 = 5.4 C). */
function nextReading(min, max) {
  if (Math.random() < SPIKE_CHANCE) return max + 20 + Math.floor(Math.random() * 60); // too warm
  return min + Math.floor(Math.random() * (max - min + 1)); // normal
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function requireEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is not set. Add it to .env (see .env.example).`);
  return value;
}

/** On Amoy, raise the tip to at least 30 gwei (same rule as scripts/deploy.js). */
async function feeOverrides(provider, chainId) {
  if (chainId !== AMOY_CHAIN_ID) return {};
  const { maxFeePerGas, maxPriorityFeePerGas } = await provider.getFeeData();
  if (maxFeePerGas == null || maxPriorityFeePerGas == null) return {};
  const tip = maxPriorityFeePerGas > AMOY_MIN_TIP ? maxPriorityFeePerGas : AMOY_MIN_TIP;
  return { maxPriorityFeePerGas: tip, maxFeePerGas: maxFeePerGas - maxPriorityFeePerGas + tip };
}

/** Uploads the reading log to IPFS. Returns the CID, or "" if IPFS is unavailable. */
async function uploadLog(batch, log, alertReading) {
  if (!ipfsConfigured()) {
    console.warn("  PINATA_JWT not set: recording the alert without a log CID.");
    return "";
  }
  const record = {
    type: "MedTrace temperature log",
    batchId: batch.id.toString(),
    productName: batch.productName,
    lotNumber: batch.lotNumber,
    allowedRangeC: { min: Number(batch.minTempTenthsC) / 10, max: Number(batch.maxTempTenthsC) / 10 },
    alertReadingC: alertReading / 10,
    generatedAt: new Date().toISOString(),
    readings: log.map(({ time, reading }) => ({ time, tempC: reading / 10 })),
  };
  try {
    const cid = await uploadJson(record, `batch-${batch.id}-templog-${Date.now()}.json`);
    console.log(`  Log uploaded to IPFS: ${cid}`);
    console.log(`  ${gatewayUrl(cid)}`);
    return cid;
  } catch (err) {
    console.warn(`  IPFS upload failed, recording the alert without a log CID: ${err.message}`);
    return "";
  }
}

async function main() {
  const contractAddress = requireEnv("CONTRACT_ADDRESS");
  const sensorKey = requireEnv("SENSOR_PRIVATE_KEY");
  if (!ethers.isAddress(contractAddress)) throw new Error(`CONTRACT_ADDRESS is not a valid address: ${contractAddress}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const { chainId } = await provider.getNetwork();
  const wallet = new ethers.Wallet(sensorKey, provider);
  if ((await provider.getCode(contractAddress)) === "0x") {
    throw new Error(`No contract at ${contractAddress} on chain ${chainId} (${RPC_URL}).`);
  }
  const medTrace = new ethers.Contract(contractAddress, ABI, wallet);

  // Pre-flight checks, so problems show up as plain messages instead of reverts.
  if (!(await medTrace.hasRole(await medTrace.SENSOR_ROLE(), wallet.address))) {
    throw new Error(
      `Sensor wallet ${wallet.address} does not have SENSOR_ROLE. ` +
        "Ask the admin to call registerParticipant(<address>, SENSOR_ROLE, \"IoT Simulator\")."
    );
  }
  let batch;
  try {
    batch = await medTrace.getBatch(BATCH_ID);
  } catch {
    throw new Error(`Batch ${BATCH_ID} does not exist on this contract.`);
  }
  const status = STATUS_NAMES[Number(batch.status)] || `status ${batch.status}`;
  if (status === "Dispensed" || status === "Recalled") {
    throw new Error(`Batch ${BATCH_ID} is ${status}, so it no longer accepts temperature alerts.`);
  }

  const min = Number(batch.minTempTenthsC);
  const max = Number(batch.maxTempTenthsC);
  console.log(`Network:  chain ${chainId} (${RPC_URL})`);
  console.log(`Sensor:   ${wallet.address}`);
  console.log(`Batch ${BATCH_ID}: ${batch.productName} (lot ${batch.lotNumber}), ${status}`);
  console.log(`Allowed:  ${min / 10}C - ${max / 10}C`);
  console.log(`IPFS:     ${ipfsConfigured() ? "Pinata" : "off (PINATA_JWT not set)"}`);
  console.log(MAX_ALERTS > 0 ? `Stopping after ${MAX_ALERTS} alert(s). Ctrl+C to stop early.\n` : "Ctrl+C to stop.\n");

  let stopping = false;
  process.on("SIGINT", () => {
    if (stopping) process.exit(130);
    stopping = true;
    console.log("\nStopping after the current reading...");
  });

  const log = []; // full off-chain log of every reading
  let alerts = 0;

  // A plain loop (not setInterval) so a slow transaction never overlaps the next reading.
  while (!stopping) {
    const reading = nextReading(min, max);
    log.push({ time: new Date().toISOString(), reading });
    const outOfRange = reading < min || reading > max;
    console.log(`reading: ${(reading / 10).toFixed(1)}C${outOfRange ? "  OUT OF RANGE" : ""}`);

    if (outOfRange) {
      try {
        const logCid = await uploadLog(batch, log, reading);
        const tx = await medTrace.recordTemperatureAlert(
          BATCH_ID,
          reading,
          logCid,
          await feeOverrides(provider, chainId)
        );
        console.log(`  Alert sent, tx ${tx.hash}`);
        await tx.wait();
        alerts += 1;
        console.log(`  ALERT recorded on-chain (${alerts}${MAX_ALERTS > 0 ? `/${MAX_ALERTS}` : ""})`);
        if (chainId === AMOY_CHAIN_ID) console.log(`  https://amoy.polygonscan.com/tx/${tx.hash}`);
      } catch (err) {
        console.error(`  Could not record the alert: ${err.shortMessage || err.message}`);
      }
      if (MAX_ALERTS > 0 && alerts >= MAX_ALERTS) break;
    }

    if (!stopping) await sleep(INTERVAL_MS);
  }

  console.log(`\nDone: ${log.length} readings, ${alerts} on-chain alert(s).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
