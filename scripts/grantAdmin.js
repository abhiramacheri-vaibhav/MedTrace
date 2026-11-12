// Gives another wallet the admin role (DEFAULT_ADMIN_ROLE) on a deployed MedTrace,
// so a second teammate can onboard participants without the deployer's key.
// The current admin keeps the role.
//
// Usage (run by an existing admin, with that wallet's PRIVATE_KEY in .env):
//   NEW_ADMIN=0xTheirAddress npm run admin:grant              (Amoy)
//   NEW_ADMIN=0xTheirAddress npx hardhat run scripts/grantAdmin.js --network localhost
//
// The contract address comes from CONTRACT_ADDRESS, or else deployments/<network>.json.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const AMOY_CHAIN_ID = 80002n;
const AMOY_MIN_TIP = 30_000_000_000n; // 30 gwei, same rule as scripts/deploy.js

function contractAddress() {
  const fromEnv = (process.env.CONTRACT_ADDRESS || "").trim();
  if (fromEnv) return fromEnv;
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")).address;
  throw new Error(`No contract address. Set CONTRACT_ADDRESS, or deploy first so deployments/${network.name}.json exists.`);
}

async function feeOverrides() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== AMOY_CHAIN_ID) return {};
  const { maxFeePerGas, maxPriorityFeePerGas } = await ethers.provider.getFeeData();
  if (maxFeePerGas == null || maxPriorityFeePerGas == null) return {};
  const tip = maxPriorityFeePerGas > AMOY_MIN_TIP ? maxPriorityFeePerGas : AMOY_MIN_TIP;
  return { maxPriorityFeePerGas: tip, maxFeePerGas: maxFeePerGas - maxPriorityFeePerGas + tip };
}

async function main() {
  const newAdmin = (process.env.NEW_ADMIN || "").trim();
  if (!ethers.isAddress(newAdmin)) {
    throw new Error("Set NEW_ADMIN to the wallet address that should become admin, e.g. NEW_ADMIN=0xabc... npm run admin:grant");
  }

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No wallet found. Put the current admin's PRIVATE_KEY in .env.");

  const address = contractAddress();
  const medTrace = await ethers.getContractAt("MedTrace", address, signer);
  const ADMIN = await medTrace.DEFAULT_ADMIN_ROLE();

  console.log(`Network:   ${network.name}`);
  console.log(`Contract:  ${address}`);
  console.log(`Signed by: ${signer.address}`);
  console.log(`New admin: ${newAdmin}\n`);

  if (!(await medTrace.hasRole(ADMIN, signer.address))) {
    throw new Error(`${signer.address} is not an admin on this contract, so it can't grant the role.`);
  }
  if (await medTrace.hasRole(ADMIN, newAdmin)) {
    console.log("That wallet is already an admin. Nothing to do.");
    return;
  }

  const tx = await medTrace.grantRole(ADMIN, newAdmin, await feeOverrides());
  console.log(`Sent, tx ${tx.hash}`);
  await tx.wait();

  const ok = await medTrace.hasRole(ADMIN, newAdmin);
  console.log(ok ? "Done: the new wallet is now an admin." : "The transaction went through but the role check failed.");
  if (network.name === "amoy") console.log(`https://amoy.polygonscan.com/tx/${tx.hash}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
