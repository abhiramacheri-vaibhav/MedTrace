// Onboards the demo participants on a deployed MedTrace and tops up their test POL.
// Run once by the admin (the deployer). Safe to re-run: wallets that already have
// their role are skipped, and wallets that already have enough POL get nothing.
//
// Usage (admin's PRIVATE_KEY in .env, same as deploy:amoy):
//   npm run demo:onboard
//
// The wallets come from deployments/<network>-demo-participants.json
// (public addresses only; the private keys stay with whoever runs the demo).
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const AMOY_CHAIN_ID = 80002n;
const AMOY_MIN_TIP = 30_000_000_000n; // 30 gwei, same rule as scripts/deploy.js

async function feeOverrides() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== AMOY_CHAIN_ID) return {};
  const { maxFeePerGas, maxPriorityFeePerGas } = await ethers.provider.getFeeData();
  if (maxFeePerGas == null || maxPriorityFeePerGas == null) return {};
  const tip = maxPriorityFeePerGas > AMOY_MIN_TIP ? maxPriorityFeePerGas : AMOY_MIN_TIP;
  return { maxPriorityFeePerGas: tip, maxFeePerGas: maxFeePerGas - maxPriorityFeePerGas + tip };
}

function loadPlan() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}-demo-participants.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing ${path.relative(process.cwd(), file)}.`);
  const plan = JSON.parse(fs.readFileSync(file, "utf8"));
  plan.contract = (process.env.CONTRACT_ADDRESS || "").trim() || plan.contract;
  for (const p of plan.participants) {
    if (!ethers.isAddress(p.address)) throw new Error(`Bad address for ${p.name}: ${p.address}`);
  }
  return plan;
}

async function main() {
  const plan = loadPlan();
  const [admin] = await ethers.getSigners();
  if (!admin) throw new Error("No wallet found. Put the admin's PRIVATE_KEY in .env.");

  const medTrace = await ethers.getContractAt("MedTrace", plan.contract, admin);
  if (!(await medTrace.hasRole(await medTrace.DEFAULT_ADMIN_ROLE(), admin.address))) {
    throw new Error(`${admin.address} is not the admin of ${plan.contract}. Use the deployer's PRIVATE_KEY.`);
  }

  const target = ethers.parseEther(plan.fundEachPol || "0");
  const needed = await Promise.all(
    plan.participants.map(async (p) => {
      const balance = await ethers.provider.getBalance(p.address);
      return balance < target ? target - balance : 0n;
    })
  );
  const totalToSend = needed.reduce((a, b) => a + b, 0n);
  const adminBalance = await ethers.provider.getBalance(admin.address);

  console.log(`Network:  ${network.name}`);
  console.log(`Contract: ${plan.contract}`);
  console.log(`Admin:    ${admin.address} (${ethers.formatEther(adminBalance)} POL)`);
  console.log(`Top-ups:  ${ethers.formatEther(totalToSend)} POL in total\n`);
  if (adminBalance < totalToSend + ethers.parseEther("0.05")) {
    throw new Error("Not enough POL in the admin wallet for the top-ups plus gas. Get more from https://faucet.polygon.technology/");
  }

  for (const [i, p] of plan.participants.entries()) {
    const role = await medTrace[p.role]();
    let line = `${p.name.padEnd(18)} ${p.address}  `;

    if (await medTrace.hasRole(role, p.address)) {
      line += "role: already set";
    } else {
      const tx = await medTrace.registerParticipant(p.address, role, p.name, await feeOverrides());
      await tx.wait();
      line += `role: ${p.role} added`;
    }

    if (needed[i] > 0n) {
      const tx = await admin.sendTransaction({ to: p.address, value: needed[i], ...(await feeOverrides()) });
      await tx.wait();
      line += `, sent ${ethers.formatEther(needed[i])} POL`;
    } else {
      line += ", POL: enough already";
    }
    console.log(line);
  }

  console.log("\nDone. Every demo wallet has its role and some test POL.");
  if (network.name === "amoy") console.log(`https://amoy.polygonscan.com/address/${plan.contract}#events`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
