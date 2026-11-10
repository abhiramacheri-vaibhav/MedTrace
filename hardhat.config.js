// Hardhat configuration for MedTrace.
// Networks:
//   - hardhat / localhost : local development chain (no setup needed)
//   - amoy                : Polygon Amoy testnet (needs .env, see .env.example)
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { AMOY_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY, POLYGONSCAN_API_KEY } = process.env;

// Only use PRIVATE_KEY if it looks like a real key (32 bytes of hex, 0x optional).
// A blank or half-edited .env must not break `npx hardhat test` / `compile`.
function deployerAccounts(key) {
  const trimmed = (key || "").trim();
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(trimmed)) {
    return [trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`];
  }
  if (trimmed !== "") {
    console.warn("Warning: PRIVATE_KEY in .env is not a 64-character hex key, so it is ignored.");
  }
  return [];
}

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    amoy: {
      url: AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com",
      chainId: 80002,
      accounts: deployerAccounts(PRIVATE_KEY),
    },
  },
  etherscan: {
    // Used by `npx hardhat verify` (and scripts/deploy.js) to publish source code on the explorer.
    // Must be a single string: hardhat-verify then uses the Etherscan V2 API, where one
    // etherscan.io key works for every chain, Amoy included. (A per-network object
    // would fall back to the deprecated V1 explorer APIs.)
    apiKey: (ETHERSCAN_API_KEY || POLYGONSCAN_API_KEY || "").trim(),
  },
  sourcify: {
    // We verify on Polygonscan only; this hides the "Sourcify is disabled" reminder.
    enabled: false,
  },
  gasReporter: {
    // Run `REPORT_GAS=true npx hardhat test` to print gas cost per function.
    enabled: process.env.REPORT_GAS === "true",
  },
};
