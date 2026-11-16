# MedTrace: Final Project Handoff

Team BlockRx · CSE 540 · for the final project, after the interim demo

This is everything you need to pick up your part of the final project code. Read the "Before you start" section first, then go to your own section.

## Key dates

| Date | What |
|---|---|
| Mon 11/16 | Plan shared. Read your section and start your branch. |
| Wed 11/18 | Rohan decides how file uploads will work |
| Sat 11/21 | Maulik's contract changes merged (everyone else builds on these) |
| Sun 11/22, 7 PM AZ | Team meeting: check progress |
| Mon 11/23 | Most tasks merged |
| **Wed 11/25** | **Code freeze.** Nothing new after this, only fixes. |
| Fri 12/04, 11:59 PM | Final project due (code, report, presentation) |

## What the graders check (code part, 25 points)

- **Everything works:** every feature from our proposal works as described.
- **Contract quality:** clean, split into sensible files, with events, role checks, input checks and clear errors.
- **All roles work:** factory, distributor, pharmacy, regulator, sensor and patient flows all run.
- **Tests:** core functions and edge cases covered; bad input is rejected properly.
- **Docs:** a clear README (setup, deploy, use) and comments that explain the main logic and why.

## Where things stand

**Done:** contracts live on Polygon Amoy and verified, 100 passing tests, gas table in the README, a web page for every role, the patient check page with live updates, IPFS documents shown in the app, real sensor alerts, lookup by lot number, paged history, and dispensing blocked when a batch got too warm.

**Still missing:**

- Files are attached by pasting an IPFS link. There's no upload button.
- Contract errors are text messages, not custom errors.
- Some old TODO notes in the code describe work that's already done.
- No test coverage number.
- The README's roadmap and usage sections are still from the design draft.
- Patients have to type the lot number. There's no QR code.

## Before you start

### Links

- Repo: https://github.com/abhiramacheri-vaibhav/MedTrace (must stay public)
- Contract on Amoy: 0x2749c1613F6dfF8283434885b985d287AC5FA2B8
- Explorer: https://amoy.polygonscan.com/address/0x2749c1613F6dfF8283434885b985d287AC5FA2B8

### Run it on your laptop

From the repo folder:

```bash
git pull origin main
npm install
npx hardhat compile
npx hardhat test

# Terminal 1: a local blockchain
npx hardhat node

# Terminal 2: demo data
npm run seed:local

# Terminal 3: the web app
cd frontend
npm install
npm run sync-contract -- 0x5FbDB2315678afecb367f032d93F642f64180aa3 localhost
npm run dev
```

Open http://localhost:5173. To try a role without MetaMask on the local chain, add `?as=<address>` to the link (for example the factory address printed by the seed script). This only works locally.

**Before you push,** switch the app back to Amoy: `npm run sync-contract -- 0x2749c1613F6dfF8283434885b985d287AC5FA2B8 amoy`, and don't commit a `contract.json` that points at localhost.

### Secrets

Copy `.env.example` to `.env` and fill in what your task needs (Amoy RPC, deployer key, Polygonscan key, sensor key, Pinata key). **Never commit `.env` or any private key.** Ask Shrey for the demo wallet keys; they aren't in this document on purpose.

### How we work

- Make a branch for your task, open a pull request, and get **one reviewer** before merging. Never push straight to `main`.
- Before opening a PR: `npx hardhat test` passes, and if you touched the app, `cd frontend && npm run build` passes.
- Commit under your own GitHub account so your work counts as yours.
- Questions go in the WhatsApp group. Tag the person who owns that part.

### Changes that affect other people

- **Contract changes** (Maulik): tell Neric (tests), Vaibhav and Shrey (app). The interface file `contracts/interfaces/IMedTrace.sol` and the README function table must stay in step.
- **Redeploying to Amoy** (Neric): the new address goes in the README and in the app (`npm run sync-contract -- <address> amoy`), and the demo wallets and batches must be loaded again with `npm run demo:onboard`.
- **Error names** (Maulik): Shrey maps them to plain messages in the app, so share the final list.

## Your tasks

### Shrey: web app screens (frontend/)

| Task | By |
|---|---|
| Upload button on the factory form and on the regulator's certify step, using Rohan's upload code | 11/23 |
| Show the new contract errors as plain messages in the app (`frontend/src/lib/contract.js`, `friendlyError`) | 11/24 |
| Final pass on every role page: wording, empty states, loading, phone screens | 11/25 |

### Maulik: core contract (contracts/)

| Task | By |
|---|---|
| Replace the `require(..., "MedTrace: ...")` text messages with custom errors in `MedTrace.sol` and `MedTraceAccess.sol`. Agree the names with Neric first, since the tests check them. Share the final list with Shrey. | 11/21 |
| Remove the old TODO notes (top of `MedTrace.sol`). Make sure every public function has a comment saying what it does and why. | 11/21 |

### Neric: tests, gas, deployment, README (test/, scripts/, README.md)

| Task | By |
|---|---|
| Run a coverage report (`npx hardhat coverage`) and add tests for anything it shows as missed: documents, expiry, paging, the new errors. Remove the old TODO at the top of `test/MedTrace.test.js`. | 11/23 |
| Refresh the gas table (`REPORT_GAS=true npx hardhat test`). If the contract changed, redeploy and verify on Amoy and update the address everywhere (see "Changes that affect other people"). | 11/24 |
| Rewrite the README's setup, deploy and usage sections so a stranger can run everything, and update the roadmap. | 11/24 |

### Vaibhav: access control and patient page (contracts/access/, frontend/src/pages/Verify.jsx)

| Task | By |
|---|---|
| QR code on each batch card that opens the patient page for that lot. The link format already works: `/verify?lot=<lot number>`. | 11/23 |
| After Maulik's change, check that the regulator rules and the live recall update on the patient page still work. | 11/24 |

### Rohan: IPFS and sensor (offchain/)

| Task | By |
|---|---|
| Decide how uploads work from the web app. A Pinata key placed in the web page can be seen by anyone, so either use a key that can only upload, or keep the paste-a-link flow and explain why in the README. Tell Shrey. | 11/18 |
| The upload code the web app calls (Shrey wires up the button). | 11/21 |
| README section on running the sensor (`npm run iot:simulate`) and the IPFS scripts. | 11/23 |

## Where things live

| Path | What | Owner |
|---|---|---|
| contracts/interfaces/IMedTrace.sol | All function signatures, events, structs | Maulik |
| contracts/MedTrace.sol | Batches, hand-offs, documents, temperature alerts, views | Maulik |
| contracts/access/MedTraceAccess.sol | Roles and who can do what | Vaibhav |
| test/ | All contract tests | Neric |
| scripts/ | Deploy, local demo data, Amoy demo setup | Neric |
| offchain/ipfs/, offchain/iot-simulator/ | IPFS upload, sensor simulator | Rohan |
| frontend/src/pages/Verify.jsx | Patient check page | Vaibhav |
| frontend/ (everything else) | Web app: role pages, wallet, shared components | Shrey |
