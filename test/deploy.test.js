// Tests for scripts/deploy.js (owner: Neric Joel, Testing & Deployment Lead).
// Runs on the in-process Hardhat network only: no RPC, no API keys, no .env.
// Anything written to disk goes to a temp folder that is removed afterwards.
const { expect } = require("chai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const hre = require("hardhat");

const {
  isLiveNetwork,
  explorerLink,
  buildDeploymentRecord,
  buildFrontendContract,
  feeOverrides,
  preflightProblem,
  verifyCommand,
  deployMedTrace,
  saveOutputs,
  verifyOnExplorer,
} = require("../scripts/deploy");

const ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const OLD_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const ADMIN = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const TX_HASH = "0x" + "ab".repeat(32);
const gwei = (n) => BigInt(n) * 1_000_000_000n;

describe("deploy script", function () {
  describe("helpers", function () {
    it("treats only hardhat and localhost as local networks", function () {
      expect(isLiveNetwork("hardhat")).to.equal(false);
      expect(isLiveNetwork("localhost")).to.equal(false);
      expect(isLiveNetwork("amoy")).to.equal(true);
    });

    it("builds Amoy explorer links and returns null for unknown chains", function () {
      expect(explorerLink(80002, "address", ADDRESS)).to.equal(`https://amoy.polygonscan.com/address/${ADDRESS}`);
      expect(explorerLink(80002, "tx", TX_HASH)).to.equal(`https://amoy.polygonscan.com/tx/${TX_HASH}`);
      expect(explorerLink(31337, "address", ADDRESS)).to.equal(null);
    });

    it("builds the deployment record with the block time as ISO string", function () {
      const record = buildDeploymentRecord({
        network: "amoy",
        chainId: 80002,
        address: ADDRESS,
        admin: ADMIN,
        txHash: TX_HASH,
        blockNumber: 123,
        blockTimestamp: 1767225600, // 2026-01-01T00:00:00Z
      });
      expect(record).to.deep.equal({
        network: "amoy",
        chainId: 80002,
        address: ADDRESS,
        deployer: ADMIN,
        txHash: TX_HASH,
        blockNumber: 123,
        deployedAt: "2026-01-01T00:00:00.000Z",
        explorerUrl: `https://amoy.polygonscan.com/address/${ADDRESS}`,
      });
      // Key order matters for readable diffs when the file is committed.
      expect(Object.keys(record)).to.deep.equal([
        "network", "chainId", "address", "deployer", "txHash", "blockNumber", "deployedAt", "explorerUrl",
      ]);
    });

    it("builds frontend/src/contract.json in the same shape as sync-contract.mjs", function () {
      const abi = [{ type: "function", name: "x" }];
      const out = buildFrontendContract({ address: ADDRESS, network: "localhost", chainId: 31337, abi });
      expect(Object.keys(out)).to.deep.equal(["address", "network", "chainId", "abi"]);
      expect(out).to.deep.equal({ address: ADDRESS, network: "localhost", chainId: 31337, abi });
    });

    it("explains how to fix a missing key or an empty wallet", function () {
      expect(preflightProblem({ signerAddress: undefined, balance: 0n })).to.match(/\.env\.example.*\.env.*PRIVATE_KEY/s);
      const empty = preflightProblem({ signerAddress: ADMIN, balance: 0n });
      expect(empty).to.include(ADMIN);
      expect(empty).to.include("https://faucet.polygon.technology/");
      expect(preflightProblem({ signerAddress: ADMIN, balance: 1n })).to.equal(null);
    });

    it("prints the manual verify command", function () {
      expect(verifyCommand("amoy", ADDRESS, ADMIN)).to.equal(`npx hardhat verify --network amoy ${ADDRESS} ${ADMIN}`);
    });
  });

  describe("feeOverrides", function () {
    it("raises a low Amoy tip to 30 gwei and the max fee by the same amount", function () {
      const out = feeOverrides(80002, { maxFeePerGas: gwei(40), maxPriorityFeePerGas: gwei(2), gasPrice: gwei(20) });
      expect(out).to.deep.equal({ maxPriorityFeePerGas: gwei(30), maxFeePerGas: gwei(68) });
    });

    it("keeps an Amoy tip that is already above the floor", function () {
      const out = feeOverrides(80002, { maxFeePerGas: gwei(100), maxPriorityFeePerGas: gwei(35) });
      expect(out).to.deep.equal({ maxPriorityFeePerGas: gwei(35), maxFeePerGas: gwei(100) });
    });

    it("returns no overrides when EIP-1559 fee data is missing", function () {
      expect(feeOverrides(80002, { maxFeePerGas: null, maxPriorityFeePerGas: gwei(2), gasPrice: gwei(20) })).to.deep.equal({});
      expect(feeOverrides(80002, { maxFeePerGas: gwei(40), maxPriorityFeePerGas: null, gasPrice: gwei(20) })).to.deep.equal({});
    });

    it("returns no overrides on other chains", function () {
      expect(feeOverrides(31337, { maxFeePerGas: gwei(40), maxPriorityFeePerGas: gwei(2) })).to.deep.equal({});
      expect(feeOverrides(1, { maxFeePerGas: gwei(40), maxPriorityFeePerGas: gwei(2) })).to.deep.equal({});
    });
  });

  describe("deployMedTrace (in-process network)", function () {
    it("deploys with the deployer as admin and returns address and tx hash", async function () {
      const frontendFile = path.join(hre.config.paths.root, "frontend", "src", "contract.json");
      const hadFrontendFile = fs.existsSync(frontendFile);
      const [deployer] = await hre.ethers.getSigners();

      let submitted;
      const result = await deployMedTrace(hre, undefined, { onSubmitted: (hash, chainId) => (submitted = { hash, chainId }) });

      // Deploying alone must not write any files (that is saveOutputs' job).
      expect(fs.existsSync(frontendFile)).to.equal(hadFrontendFile);

      expect(result.address).to.match(/^0x[0-9a-fA-F]{40}$/);
      expect(result.txHash).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(submitted).to.deep.equal({ hash: result.txHash, chainId: 31337 });
      expect(result.admin).to.equal(deployer.address);
      expect(result.chainId).to.equal(31337);
      expect(result.blockNumber).to.be.a("number");

      const medTrace = await hre.ethers.getContractAt("MedTrace", result.address);
      expect(await medTrace.hasRole(await medTrace.DEFAULT_ADMIN_ROLE(), deployer.address)).to.equal(true);
    });
  });

  describe("saveOutputs", function () {
    let root;
    const abi = [{ type: "function", name: "x" }];
    const record = (network) =>
      buildDeploymentRecord({
        network,
        chainId: network === "amoy" ? 80002 : 31337,
        address: ADDRESS,
        admin: ADMIN,
        txHash: TX_HASH,
        blockNumber: 1,
        blockTimestamp: 1767225600,
      });
    const frontendFile = () => path.join(root, "frontend", "src", "contract.json");
    const recordFile = () => path.join(root, "deployments", "amoy.json");

    beforeEach(function () {
      root = fs.mkdtempSync(path.join(os.tmpdir(), "medtrace-deploy-"));
      fs.mkdirSync(path.join(root, "frontend", "src"), { recursive: true });
    });

    afterEach(function () {
      fs.rmSync(root, { recursive: true, force: true });
    });

    it("writes nothing for the in-process hardhat network", function () {
      const out = saveOutputs({ networkName: "hardhat", record: record("hardhat"), abi, rootDir: root });
      expect(out).to.deep.equal({ written: [], replaced: null });
      expect(fs.existsSync(path.join(root, "deployments"))).to.equal(false);
      expect(fs.existsSync(frontendFile())).to.equal(false);
    });

    it("writes only the front-end file for localhost, formatted like sync-contract.mjs", function () {
      const out = saveOutputs({ networkName: "localhost", record: record("localhost"), abi, rootDir: root });
      expect(out.written).to.deep.equal([frontendFile()]);
      expect(fs.existsSync(path.join(root, "deployments"))).to.equal(false);
      const expected = { address: ADDRESS, network: "localhost", chainId: 31337, abi };
      expect(fs.readFileSync(frontendFile(), "utf8")).to.equal(JSON.stringify(expected, null, 2));
    });

    it("writes the deployment record and the front-end file for a live network", function () {
      const out = saveOutputs({ networkName: "amoy", record: record("amoy"), abi, rootDir: root });
      expect(out).to.deep.equal({ written: [recordFile(), frontendFile()], replaced: null });
      expect(fs.readFileSync(recordFile(), "utf8")).to.equal(JSON.stringify(record("amoy"), null, 2) + "\n");
      const expected = { address: ADDRESS, network: "amoy", chainId: 80002, abi };
      expect(fs.readFileSync(frontendFile(), "utf8")).to.equal(JSON.stringify(expected, null, 2));
    });

    it("reports the previous address when it replaces an existing record", function () {
      fs.mkdirSync(path.dirname(recordFile()));
      fs.writeFileSync(recordFile(), JSON.stringify({ address: OLD_ADDRESS }));
      const out = saveOutputs({ networkName: "amoy", record: record("amoy"), abi, rootDir: root });
      expect(out.replaced).to.deep.equal({ file: recordFile(), previousAddress: OLD_ADDRESS });
      expect(JSON.parse(fs.readFileSync(recordFile(), "utf8")).address).to.equal(ADDRESS);
    });

    it("still replaces a corrupt existing record without crashing", function () {
      fs.mkdirSync(path.dirname(recordFile()));
      fs.writeFileSync(recordFile(), "{ not json");
      const out = saveOutputs({ networkName: "amoy", record: record("amoy"), abi, rootDir: root });
      expect(out.replaced.previousAddress).to.match(/^unknown/);
      expect(JSON.parse(fs.readFileSync(recordFile(), "utf8"))).to.deep.equal(record("amoy"));
    });

    it("skips the front-end file when frontend/src does not exist", function () {
      fs.rmSync(path.join(root, "frontend"), { recursive: true, force: true });
      const out = saveOutputs({ networkName: "amoy", record: record("amoy"), abi, rootDir: root });
      expect(out.written).to.deep.equal([recordFile()]);
      expect(fs.existsSync(path.join(root, "frontend"))).to.equal(false);
    });
  });

  // Stubbed hre: no network, no explorer, no waiting.
  describe("verifyOnExplorer", function () {
    let logs, original;

    beforeEach(function () {
      logs = [];
      original = { log: console.log, warn: console.warn };
      console.log = (...args) => logs.push(args.join(" "));
      console.warn = (...args) => logs.push(args.join(" "));
    });

    afterEach(function () {
      console.log = original.log;
      console.warn = original.warn;
    });

    function stub({ apiKey = "test-key", run, wait = async () => {} } = {}) {
      const calls = [];
      const fakeHre = {
        network: { name: "amoy" },
        config: { etherscan: { apiKey } },
        run: async (...args) => {
          calls.push(args);
          return run(calls.length);
        },
      };
      const result = { address: ADDRESS, admin: ADMIN, tx: { wait } };
      return { fakeHre, result, calls };
    }

    const manual = `npx hardhat verify --network amoy ${ADDRESS} ${ADMIN}`;

    it("skips verification and prints the manual command when no API key is set", async function () {
      const { fakeHre, result, calls } = stub({ apiKey: "", run: () => {} });
      expect(await verifyOnExplorer(fakeHre, result)).to.equal(false);
      expect(calls).to.have.length(0);
      expect(logs.join("\n")).to.include(manual);
    });

    it("calls verify:verify with the admin as constructor argument", async function () {
      const { fakeHre, result, calls } = stub({ run: () => {} });
      expect(await verifyOnExplorer(fakeHre, result)).to.equal(true);
      expect(calls).to.deep.equal([["verify:verify", { address: ADDRESS, constructorArguments: [ADMIN] }]]);
    });

    it("treats 'already verified' as success", async function () {
      const { fakeHre, result } = stub({
        run: () => {
          throw new Error(`The block explorer's API responded that the contract at ${ADDRESS} is already verified.`);
        },
      });
      expect(await verifyOnExplorer(fakeHre, result)).to.equal(true);
    });

    it("returns false on a generic error and shows the reason lines", async function () {
      const { fakeHre, result } = stub({
        run: () => {
          throw new Error("Failed to verify contract.\n\nReason: Invalid API Key\nMore detail\nEven more");
        },
      });
      expect(await verifyOnExplorer(fakeHre, result)).to.equal(false);
      const output = logs.join("\n");
      expect(output).to.include("Reason: Invalid API Key");
      expect(output).to.include("More detail");
      expect(output).not.to.include("Even more");
      expect(output).to.include(manual);
    });

    it("returns false when waiting for confirmations fails", async function () {
      const { fakeHre, result, calls } = stub({
        run: () => {},
        wait: async () => {
          throw new Error("RPC hiccup");
        },
      });
      expect(await verifyOnExplorer(fakeHre, result)).to.equal(false);
      expect(calls).to.have.length(0);
      expect(logs.join("\n")).to.include(manual);
    });

    it("waits for confirmations with a timeout", async function () {
      let waitArgs;
      const { fakeHre, result } = stub({ run: () => {}, wait: async (...args) => (waitArgs = args) });
      await verifyOnExplorer(fakeHre, result);
      expect(waitArgs[0]).to.be.greaterThan(1);
      expect(waitArgs[1]).to.be.a("number");
    });

    it("retries while the explorer has not indexed the contract yet", async function () {
      const { fakeHre, result, calls } = stub({
        run: (n) => {
          if (n === 1) throw new Error(`The address ${ADDRESS} does not have bytecode.`);
        },
      });
      expect(await verifyOnExplorer(fakeHre, result, { retryDelayMs: 0 })).to.equal(true);
      expect(calls).to.have.length(2);
    });
  });
});
