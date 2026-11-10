// Deploys MedTrace and makes the deployer the admin.
// Usage:
//   npx hardhat run scripts/deploy.js --network localhost
//   npx hardhat run scripts/deploy.js --network amoy      (same as `npm run deploy:amoy`)
//
// On a live network (anything other than hardhat/localhost) the script also:
//   1. checks the deployer wallet before sending anything (key set? has POL?),
//   2. writes deployments/<network>.json (public data, meant to be committed),
//   3. verifies the source on the block explorer if ETHERSCAN_API_KEY is set.
// After localhost or live deployments it writes frontend/src/contract.json for the dApp.
const fs = require("fs");
const path = require("path");

const LOCAL_NETWORKS = ["hardhat", "localhost"];
const AMOY_CHAIN_ID = 80002;
const EXPLORERS = { [AMOY_CHAIN_ID]: "https://amoy.polygonscan.com" };
const FAUCET_URL = "https://faucet.polygon.technology/";
const AMOY_MIN_TIP = 30_000_000_000n; // 30 gwei; Amoy rejects or stalls txs tipping under ~25 gwei
const VERIFY_CONFIRMATIONS = 5; // give the explorer a few blocks to index the contract
const VERIFY_WAIT_TIMEOUT_MS = 120_000;
const VERIFY_ATTEMPTS = 3;
const VERIFY_RETRY_DELAY_MS = 20_000;

// Thrown for problems the user can fix (missing key, empty wallet).
// main() prints just the message instead of a stack trace.
class PreflightError extends Error {}

// ---------- small pure helpers (unit tested in test/deploy.test.js) ----------

function isLiveNetwork(networkName) {
  return !LOCAL_NETWORKS.includes(networkName);
}

// kind is "address" or "tx". Returns null when we don't know the explorer.
function explorerLink(chainId, kind, value) {
  const base = EXPLORERS[chainId];
  return base ? `${base}/${kind}/${value}` : null;
}

// The record saved to deployments/<network>.json.
function buildDeploymentRecord({ network, chainId, address, admin, txHash, blockNumber, blockTimestamp }) {
  return {
    network,
    chainId,
    address,
    deployer: admin, // the deployer is also the contract admin
    txHash,
    blockNumber,
    deployedAt: new Date(blockTimestamp * 1000).toISOString(),
    explorerUrl: explorerLink(chainId, "address", address),
  };
}

// Same shape as frontend/scripts/sync-contract.mjs writes.
function buildFrontendContract({ address, network, chainId, abi }) {
  return { address, network, chainId, abi };
}

// Gas fee overrides for the deploy transaction. On Amoy we raise the tip to at
// least 30 gwei (and raise the max fee by the same amount); everywhere else, or
// if the RPC gave no EIP-1559 fee data, we let Hardhat pick the fees.
function feeOverrides(chainId, feeData) {
  const { maxFeePerGas, maxPriorityFeePerGas } = feeData || {};
  if (chainId !== AMOY_CHAIN_ID || maxFeePerGas == null || maxPriorityFeePerGas == null) return {};
  const tip = maxPriorityFeePerGas > AMOY_MIN_TIP ? maxPriorityFeePerGas : AMOY_MIN_TIP;
  return { maxPriorityFeePerGas: tip, maxFeePerGas: maxFeePerGas - maxPriorityFeePerGas + tip };
}

// Returns a friendly error message, or null if the wallet is ready to deploy.
function preflightProblem({ signerAddress, balance }) {
  if (!signerAddress) {
    return (
      "No deployer account found.\n" +
      "Copy .env.example to .env and set PRIVATE_KEY to the private key of a test-only wallet\n" +
      "(64 hex characters, with or without 0x). Never use a wallet that holds real funds."
    );
  }
  if (balance === 0n) {
    return (
      `The deployer wallet ${signerAddress} has no POL to pay for gas.\n` +
      `Get free test POL from ${FAUCET_URL} (choose Amoy) and run the command again.`
    );
  }
  return null;
}

function verifyCommand(networkName, address, admin) {
  return `npx hardhat verify --network ${networkName} ${address} ${admin}`;
}

// First few non-empty lines of an error, indented. hardhat-verify puts the
// actual cause ("Reason: ...") a couple of lines below the headline.
function errorSummary(err, maxLines = 3) {
  return String((err && err.message) || err)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .map((line) => `  ${line}`)
    .join("\n");
}

// ---------- steps that talk to the network ----------

// Checks the deployer before any transaction is sent. Only used on live networks.
async function preflight(hre) {
  const { ethers, network } = hre;

  // hardhat.config.js leaves `accounts` empty when PRIVATE_KEY is missing or malformed.
  // Checking the config first means we stop without even contacting the RPC.
  const configured = network.config.accounts;
  const signers = Array.isArray(configured) && configured.length === 0 ? [] : await ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) throw new PreflightError(preflightProblem({ signerAddress: undefined }));

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`Network:  ${network.name} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} POL`);

  const problem = preflightProblem({ signerAddress: deployer.address, balance });
  if (problem) throw new PreflightError(problem);

  await warnIfBalanceLow(hre, deployer, balance, chainId);
  return deployer;
}

// Estimates the deployment cost (with the same fee rule the deploy uses) and
// warns, without stopping, if the wallet looks short.
async function warnIfBalanceLow(hre, deployer, balance, chainId) {
  const { ethers } = hre;
  try {
    const factory = await ethers.getContractFactory("MedTrace", deployer);
    const tx = await factory.getDeployTransaction(deployer.address);
    const gas = await ethers.provider.estimateGas({ ...tx, from: deployer.address });
    const fees = await ethers.provider.getFeeData();
    const maxFee = feeOverrides(chainId, fees).maxFeePerGas ?? fees.maxFeePerGas ?? fees.gasPrice ?? 0n;
    const cost = gas * maxFee;
    console.log(`Estimated deployment cost: up to ${ethers.formatEther(cost)} POL`);
    if (balance < cost) {
      console.warn(`Warning: balance may be too low. Top up at ${FAUCET_URL} if the deployment fails.`);
    }
  } catch (err) {
    console.warn(`(Could not estimate the deployment cost: ${err.shortMessage || err.message})`);
  }
}

// Deploys MedTrace with the deployer as admin and waits until it is mined.
// Quiet and writes no files, so tests can call it safely. Pass onSubmitted to
// hear about the tx hash as soon as it is sent (before it is mined).
async function deployMedTrace(hre, signer, { onSubmitted } = {}) {
  const { ethers } = hre;
  const deployer = signer || (await ethers.getSigners())[0];
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const overrides = feeOverrides(chainId, await ethers.provider.getFeeData());

  const MedTrace = await ethers.getContractFactory("MedTrace", deployer);
  const medTrace = await MedTrace.deploy(deployer.address, overrides);
  const tx = medTrace.deploymentTransaction();
  if (onSubmitted) onSubmitted(tx.hash, chainId);

  await medTrace.waitForDeployment();
  const receipt = await tx.wait();
  const block = await ethers.provider.getBlock(receipt.blockNumber);

  return {
    contract: medTrace,
    tx,
    address: await medTrace.getAddress(),
    admin: deployer.address,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    blockTimestamp: block.timestamp,
    chainId,
  };
}

function writeJson(file, data, trailingNewline) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + (trailingNewline ? "\n" : ""));
}

// Address stored in an existing deployment record. Never throws on a bad file.
function readPreviousAddress(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")).address || "unknown";
  } catch {
    return "unknown (old file could not be read)";
  }
}

// Writes deployments/<network>.json (live networks) and frontend/src/contract.json
// (localhost + live, only if frontend/src exists). Nothing is written for the
// in-process hardhat network: that contract is gone as soon as the command ends.
// Returns { written: [files], replaced: { file, previousAddress } or null }.
function saveOutputs({ networkName, record, abi, rootDir }) {
  const result = { written: [], replaced: null };
  if (networkName === "hardhat") return result;

  if (isLiveNetwork(networkName)) {
    const recordFile = path.join(rootDir, "deployments", `${networkName}.json`);
    if (fs.existsSync(recordFile)) {
      result.replaced = { file: recordFile, previousAddress: readPreviousAddress(recordFile) };
    }
    writeJson(recordFile, record, true);
    result.written.push(recordFile);
  }

  const frontendSrc = path.join(rootDir, "frontend", "src");
  if (fs.existsSync(frontendSrc)) {
    const frontendFile = path.join(frontendSrc, "contract.json");
    const contract = buildFrontendContract({
      address: record.address,
      network: networkName,
      chainId: record.chainId,
      abi,
    });
    writeJson(frontendFile, contract, false); // same formatting as sync-contract.mjs
    result.written.push(frontendFile);
  }
  return result;
}

function hasExplorerApiKey(hre) {
  const key = hre && hre.config && hre.config.etherscan && hre.config.etherscan.apiKey;
  return typeof key === "string" && key.trim() !== "";
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Publishes the source code on the block explorer. Never throws: a failed
// verification must not make a good deployment look like a failure.
// Returns true when the contract is verified (or already was).
async function verifyOnExplorer(hre, result, { retryDelayMs = VERIFY_RETRY_DELAY_MS } = {}) {
  const manual = verifyCommand(hre.network.name, result.address, result.admin);

  if (!hasExplorerApiKey(hre)) {
    console.log("\nSkipping source verification: ETHERSCAN_API_KEY is not set in .env.");
    console.log(`To verify later, run:\n  ${manual}`);
    return false;
  }

  try {
    console.log(`\nWaiting for ${VERIFY_CONFIRMATIONS} confirmations before verifying...`);
    await result.tx.wait(VERIFY_CONFIRMATIONS, VERIFY_WAIT_TIMEOUT_MS);

    for (let attempt = 1; ; attempt++) {
      try {
        await hre.run("verify:verify", { address: result.address, constructorArguments: [result.admin] });
        console.log("Source code verified.");
        return true;
      } catch (err) {
        const message = String((err && err.message) || err);
        if (/already verified/i.test(message)) {
          console.log("Source code was already verified.");
          return true;
        }
        // The explorer may not have indexed a brand-new contract yet: wait and retry.
        if (/does not have bytecode/i.test(message) && attempt < VERIFY_ATTEMPTS) {
          console.log(`Explorer has not indexed the contract yet, retrying in ${retryDelayMs / 1000}s...`);
          await sleep(retryDelayMs);
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    console.warn("\nVerification did not complete (the deployment itself is fine):");
    console.warn(errorSummary(err));
    console.warn(`To verify by hand, run:\n  ${manual}`);
    return false;
  }
}

// ---------- entry point ----------

async function main() {
  const hre = require("hardhat");
  const { network } = hre;
  const root = hre.config.paths.root;
  const live = isLiveNetwork(network.name);

  const deployer = live ? await preflight(hre) : (await hre.ethers.getSigners())[0];
  console.log(`\nDeploying MedTrace to "${network.name}" from ${deployer.address}...`);

  const result = await deployMedTrace(hre, deployer, {
    onSubmitted: (txHash, chainId) => {
      console.log(`Deployment tx sent:   ${txHash}`);
      const txUrl = explorerLink(chainId, "tx", txHash);
      if (txUrl) console.log(`Explorer (tx):        ${txUrl}`);
      console.log("Waiting for it to be mined...");
    },
  });
  console.log(`MedTrace deployed at: ${result.address} (block ${result.blockNumber})`);
  const addressUrl = explorerLink(result.chainId, "address", result.address);
  if (addressUrl) console.log(`Explorer (contract):  ${addressUrl}`);

  // Save the record before verification, so it is on disk even if verification fails.
  const record = buildDeploymentRecord({ network: network.name, ...result });
  const { abi } = await hre.artifacts.readArtifact("MedTrace");
  const { written, replaced } = saveOutputs({ networkName: network.name, record, abi, rootDir: root });
  if (replaced) {
    console.log(`Replaced ${path.relative(root, replaced.file)} (previous address: ${replaced.previousAddress})`);
  }
  for (const file of written) console.log(`Wrote ${path.relative(root, file)}`);

  if (network.name === "hardhat") {
    console.log("\nNote: this was the in-process network, so the contract is gone when this command ends.");
    console.log("Use `npx hardhat node` and `--network localhost` for a chain that stays up.");
    return;
  }

  if (live) {
    await verifyOnExplorer(hre, result);
    console.log(`\nNext: commit deployments/${network.name}.json and add the address + explorer link to README section 8.`);
  }
  console.log("Off-chain scripts: set CONTRACT_ADDRESS in .env to the address above.");
}

if (require.main === module) {
  main().catch((err) => {
    if (err instanceof PreflightError) {
      console.error(`\nPre-flight check failed: ${err.message}`);
    } else {
      console.error(err);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  isLiveNetwork,
  explorerLink,
  buildDeploymentRecord,
  buildFrontendContract,
  feeOverrides,
  preflightProblem,
  verifyCommand,
  preflight,
  deployMedTrace,
  saveOutputs,
  verifyOnExplorer,
};
