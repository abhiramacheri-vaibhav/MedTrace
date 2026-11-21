# MedTrace: Final Project Handoff

Team BlockRx · CSE 540 · for the final project, after the interim demo

This is everything you need to pick up your part of the final project code. Read the "Before you start" section first, then go to your own section.

## Latest update (Sat 11/21, evening)

- **Merged today:** Neric's tests and README (PR #15), Maulik's custom errors (PR #16) and Neric's redeploy (PR #17). `main` has 120 passing tests and 100% coverage.
- **New contract on Amoy:** `0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491`. The four demo wallets already have their roles and 0.15 POL each. **Everyone:** in `frontend/`, run `npm run sync-contract -- 0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491 amoy` to point your app at it.
- **The new contract has no batches yet.** The insulin, amoxicillin and sensor-test batches stayed on the old contract, so the demo data has to be loaded again before the final presentation (see Neric's section).
- **Neric, please still review Maulik's error names.** They're live now, so a rename would need another redeploy. Only worth it if a name is actually wrong.
- **Vaibhav and Rohan:** no PRs yet. Rohan's upload decision was due 11/18, so please post it in the group.

## Key dates

| Date | What |
|---|---|
| Mon 11/16 | Plan shared. Read your section and start your branch. |
| Wed 11/18 | Rohan decides how file uploads will work (still open) |
| Sat 11/21 | Maulik's contract changes merged ✅ |
| Sat 11/21 | Neric redeploys to Amoy with the new errors ✅ |
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

**Done:** contracts live on Polygon Amoy and verified, 120 passing tests with 100% coverage, named custom errors, a rewritten README, gas table in the README, a web page for every role, the patient check page with live updates, IPFS documents shown in the app, real sensor alerts, lookup by lot number, paged history, and dispensing blocked when a batch got too warm.

**Still missing:**

- Files are attached by pasting an IPFS link. There's no upload button.
- The new Amoy contract has no demo batches yet.
- The app still shows the old text errors and doesn't yet turn the new error names into plain messages.
- Patients have to type the lot number. There's no QR code.

## Before you start

### Links

- Repo: https://github.com/abhiramacheri-vaibhav/MedTrace (must stay public)
- Contract on Amoy: 0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491 (deployed 11/21; the old `0x2749…` is retired)
- Explorer: https://amoy.polygonscan.com/address/0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491

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

`frontend/src/contract.json` isn't committed (it's git-ignored), so run `sync-contract` again whenever you switch between the local chain and Amoy, or after a redeploy.

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
| Show the new contract errors as plain messages in the app (`frontend/src/lib/contract.js`, `friendlyError`), using the messages in `docs/custom-errors.md`. Unblocked now that the redeploy is done. | 11/24 |
| Final pass on every role page: wording, empty states, loading, phone screens | 11/25 |

### Maulik: core contract (contracts/)

| Task | By |
|---|---|
| ✅ Done (PR #16). Text errors replaced with 23 named custom errors, listed in `docs/custom-errors.md`. | 11/21 |
| ✅ Done (PR #16). Old TODO notes removed, comments on every public function. | 11/21 |
| Once Neric confirms the error names, update the top of `docs/custom-errors.md`, which still says they're "proposed". | 11/23 |

### Neric: tests, gas, deployment, README (test/, scripts/, README.md)

| Task | By |
|---|---|
| ✅ Done (PR #15). 120 tests, 100% coverage, old TODO removed. | 11/23 |
| Review Maulik's error names in `docs/custom-errors.md` (PR #16 merged without your sign-off; they're now live). | 11/22 |
| ✅ Done (PR #17). Redeployed and verified on Amoy, address updated, demo wallets onboarded. | 11/22 |
| Load the demo batches onto the new contract before the final recording: insulin `INS-2611-A` on its way to FastMed and certified, amoxicillin `AMX-2611-B` at FastMed and certified, and a sensor-test batch with a temperature alert. A few spares of each help in case a take goes wrong. | 11/30 |
| ✅ Done (PR #17). Gas table refreshed: deployment 8.4% cheaper with custom errors. | 11/24 |
| ✅ Done (PR #15). README setup, usage, deploy and roadmap rewritten. | 11/24 |

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
