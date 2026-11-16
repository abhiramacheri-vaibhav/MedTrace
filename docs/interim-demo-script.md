# MedTrace Interim Demo: script

Target: 5 minutes (allowed 4:30 to 5:30). Speakers: Shrey, Maulik, Neric and Rohan (Vaibhav cannot join). Read it loosely, in your own words.

## Before we hit record

- Shrey shares his screen. Big browser zoom (125%), big editor font.
- MetaMask is on Polygon Amoy, with the four demo wallets imported: Acme Pharma, FastMed Logistics, Tempe Pharmacy, Drug Regulator.
- Tabs open, in this order:
  1. The app, patient page, lot `SENSOR-TEST-001` already typed in
  2. Polygonscan, the contract page (green "verified" tick visible)
  3. The app, logged in as FastMed Logistics
  4. A second window with the patient page for lot `AMX-2611-B`
  5. The code editor with the repo open
- Batch numbers on Amoy: #1 is the sensor test (too warm), #2 is the insulin for the main flow (on its way to FastMed), #3 is the amoxicillin to recall (sitting at FastMed).
- Each blockchain step takes a few seconds. Keep talking while it confirms.

---

## 0:00 – 0:20 · Opening (Shrey)

**Screen:** patient page, press "Check it" on `SENSOR-TEST-001`. It turns red.

> Hi, we're Team BlockRx and this is MedTrace. It tracks a batch of medicine from the factory to the patient on a blockchain. This is what a patient sees when a batch got too warm on the way: "Do not use." Let's show how it got there.

## 0:20 – 0:55 · Where we are (Maulik)

**Screen:** the README, or one simple slide with three lists.

> **Done:** the smart contracts, 100 passing tests, the contract live on the Polygon Amoy test network, a web app for every role, the patient check page, files stored on IPFS, and live temperature alerts from a simulated sensor.
>
> **In progress:** uploading files straight from the web page. Today the factory pastes an IPFS link instead.
>
> **Left for the final:** a cost and scale analysis, the full report, and a smoother way for patients to find their lot number.

## 0:55 – 1:15 · It's really on the blockchain (Neric)

**Screen:** Polygonscan tab.

> This is our contract on Polygon Amoy. The green tick means the code is verified, so anyone can read exactly what's running. Every action you'll see next shows up here as a real transaction.

## 1:15 – 3:10 · One batch, factory to patient (Neric)

**Screen:** the app as FastMed Logistics.

> Batch #2 is insulin. The factory, Acme Pharma, registered it and sent it to FastMed. A regulator already certified it.

1. Click **Accept delivery** on the insulin as FastMed.
   > A hand-off needs both sides to sign. Acme sent it, and now FastMed confirms it actually arrived. Neither side can fake a delivery on its own.
2. Click **Hand off to…** and pick Tempe Pharmacy.
3. Switch MetaMask to **Tempe Pharmacy** and click **Accept delivery**.
4. Click **Dispense to patient**.
   > Once dispensed, the batch is locked. Nobody can move it again.
5. Open the card's **Details** and point at the history.
   > Every step is listed with who did it and when, straight from the chain.
6. Click **"See what a patient sees."**
   > And the patient types the lot number from the box: "Safe to use." Checking is free. No wallet, no fees.

## 3:10 – 3:35 · The recall (Maulik)

**Screen:** the second window, patient page for `AMX-2611-B`, showing green. Then the app as **Drug Regulator**.

> This amoxicillin, batch #3, is fine right now. A patient has the page open. Now the regulator finds a problem.

- As the regulator: **Recall** batch #3, pick "Contamination."
- Switch back to the patient window. It turns red by itself.

> The patient page listens for the recall on the blockchain and updates on its own, with the regulator's reason.

## 3:35 – 4:35 · How it's built (code walkthrough)

**Screen:** the code editor. Keep each part to about 15 seconds.

**Maulik:**
> The main contract is `contracts/MedTrace.sol`. `registerBatch` creates a batch. `transferCustody` and `confirmReceipt` are the two-step hand-off. `markDispensed` refuses a batch that got too warm. I also added `getBatchIdsByLot`, which is how the patient page finds a batch from the lot number on the box.

**Maulik** (Vaibhav's part):
> Vaibhav built the access rules and the patient page. `contracts/access/MedTraceAccess.sol` decides who can do what. Each wallet gets a role, like factory or regulator. `certifyBatch` and `recallBatch` are regulator-only. The patient page, `frontend/src/pages/Verify.jsx`, calls `verifyBatch` and listens for the `BatchRecalled` event.

**Rohan:**
> Big files don't go on the blockchain. `offchain/ipfs/uploadToIpfs.js` puts them on IPFS and gives back a short ID, and only that ID is stored on-chain. The sensor, `offchain/iot-simulator/simulateSensor.js`, only writes to the chain when a reading is out of range. It uploads its log first. That's batch #1, the one from the start.

**Neric:**
> `scripts/deploy.js` deploys and verifies the contract. Our tests in `test/` cover the normal flow and the edge cases, like a stranger trying to move a batch, or recalling something already dispensed. The README has the gas cost of every function.

**Shrey:**
> The web app reads and writes through `frontend/src/lib/contract.js`, and MetaMask signs every action. Each role gets its own page, so a pharmacy only sees what a pharmacy can do.

## 4:35 – 5:00 · Wrap up (Rohan)

> So: a batch can be tracked from factory to patient, every hand-off needs both sides, regulators can recall, sensors can raise alarms, and anyone can check a batch for free. Next we'll do file uploads in the app, measure costs and scale, and write the report. Thanks for watching.

---

## If something goes wrong while recording

- **A transaction is slow:** keep talking. It usually confirms in 5 to 15 seconds.
- **MetaMask is on the wrong account:** the name at the top right of the app shows who you are. Switch accounts in MetaMask and the page follows.
- **A step fails:** stop, and we redo just that part. Batches can't be reset, so check with Shrey before redoing a hand-off.
