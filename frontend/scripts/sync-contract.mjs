// Writes src/contract.json from the deployed address + the Hardhat artifact,
// so the app knows where the contract lives and what its functions look like.
//
// Usage (from the frontend/ folder, after `npx hardhat compile` at the repo root):
//   npm run sync-contract -- <address> [network] [deployBlock]
//   npm run sync-contract -- 0x5FbDB2315678afecb367f032d93F642f64180aa3 localhost
//   npm run sync-contract -- 0xYourAmoyAddress amoy
//
// deployBlock is where the app starts reading events. Public Amoy endpoints refuse
// event searches over 10,000 blocks, so the app reads in chunks from this block.
// If it's left out, it's taken from ../deployments/<network>.json when the address
// matches, otherwise 0 (fine for a local node).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [address, network = "localhost", blockArg] = process.argv.slice(2);

if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error("Usage: npm run sync-contract -- <0xContractAddress> [localhost|amoy]");
  process.exit(1);
}

const artifactPath = resolve(here, "../../artifacts/contracts/MedTrace.sol/MedTrace.json");
if (!existsSync(artifactPath)) {
  console.error(`Artifact not found at ${artifactPath}. Run \`npx hardhat compile\` at the repo root first.`);
  process.exit(1);
}

const CHAIN_IDS = { localhost: 31337, hardhat: 31337, amoy: 80002 };
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

let deployBlock = 0;
const deploymentPath = resolve(here, `../../deployments/${network}.json`);
if (blockArg !== undefined) {
  deployBlock = Number(blockArg);
  if (!Number.isInteger(deployBlock) || deployBlock < 0) {
    console.error(`deployBlock must be a whole number, got "${blockArg}".`);
    process.exit(1);
  }
} else if (existsSync(deploymentPath)) {
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
  if (deployment.address?.toLowerCase() === address.toLowerCase()) deployBlock = Number(deployment.blockNumber) || 0;
}
if (deployBlock === 0 && network === "amoy") {
  console.warn("Warning: no deploy block for this Amoy address. Pass it as the third argument, or the app can't read events.");
}

const out = {
  address,
  network,
  chainId: CHAIN_IDS[network] ?? null,
  deployBlock,
  abi: artifact.abi,
};
const outPath = resolve(here, "../src/contract.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath}\n  network: ${network} (chainId ${out.chainId})\n  address: ${address}\n  deploy block: ${deployBlock}`);
