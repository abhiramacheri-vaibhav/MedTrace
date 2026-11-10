// Writes src/contract.json from the deployed address + the Hardhat artifact,
// so the app knows where the contract lives and what its functions look like.
//
// Usage (from the frontend/ folder, after `npx hardhat compile` at the repo root):
//   npm run sync-contract -- <address> [network]
//   npm run sync-contract -- 0x5FbDB2315678afecb367f032d93F642f64180aa3 localhost
//   npm run sync-contract -- 0xYourAmoyAddress amoy
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [address, network = "localhost"] = process.argv.slice(2);

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
const out = {
  address,
  network,
  chainId: CHAIN_IDS[network] ?? null,
  abi: artifact.abi,
};
const outPath = resolve(here, "../src/contract.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath}\n  network: ${network} (chainId ${out.chainId})\n  address: ${address}`);
