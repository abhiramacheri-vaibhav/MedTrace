# Interim Demo: who does what, by when

**Recording due:** Saturday 15 Nov, 11:59 pm (Canvas, one `.txt` with the Zoom link + passcode).
**We record:** Thursday 13 Nov. **Rehearsal:** Wednesday 12 Nov. **Feature freeze:** Tuesday 11 Nov, end of day.

The demo is one insulin batch going factory → distributor → pharmacy → patient in the web app, plus a regulator recall as the "do not use" case. Five minutes, everyone speaks. Speaking parts get assigned once the work has landed.

## Tasks

Tick your box in a PR when it's done. "Done" means merged to `main` and working against `npm run seed:local`.

### Neric: deployment + tests
- [x] Test wallet created, test POL in it, Etherscan API key obtained
- [x] `npm run deploy:amoy` succeeds; contract verified on `amoy.polygonscan.com`
- [x] Contract address + explorer link added to README section 8
- [x] `REPORT_GAS=true npx hardhat test` output pasted into the README as a table
- [x] At least two new edge-case tests (e.g. recall after dispense is rejected, non-holder can't hand off)

### Vaibhav: verify page + regulator module
- [ ] `frontend/src/pages/Verify.jsx` built (the stub lists exactly what it needs to do)
- [ ] Green "Safe to use" / red "Do not use" verdict with a plain-words reason
- [ ] Custody timeline shown under the verdict (reuse `BatchCard`)
- [ ] Page flips live when a `BatchRecalled` event arrives for the shown batch
- [ ] `certifyBatch` / `recallBatch` reviewed; any change comes with a test

### Maulik: core contract
- [ ] Lot-number lookup: `getBatchByLot(string)` or equivalent, with a test
- [ ] Decide and implement the dispense rule when `temperatureBreached` is true (block or warn); update `docs/design.md`
- [ ] `getHistory` pagination if time allows (not needed for the demo)

### Rohan: off-chain
- [x] `offchain/ipfs/uploadToIpfs.js` uploads a file to Pinata and returns a real CID
- [x] `simulateSensor.js` runs against the deployed contract and writes one real temperature alert ([alert tx](https://amoy.polygonscan.com/tx/0x2113e64351badce22a3e7fff8b8eb5c0cfb173d594fbdcd8bc13457329c22f62) on batch #1, the "sensor test" batch)
- [x] If IPFS isn't ready by Tuesday: say so in the group, and we label documents "sample" in the demo (not needed: IPFS works)

### Shrey: web app + recording
- [x] Front-end scaffold: connect, role detection, factory / distributor / pharmacy / regulator / operator pages, custody timeline, recording mode
- [ ] Polish pass on the role pages after everyone's parts land
- [ ] Demo data seeded on Amoy (batch #1 walked to the distributor, batch #2 ready to recall)
- [ ] Demo script; host the Zoom recording; upload the `.txt`

## How to work

1. Pull `main`, make a branch (`feat/<your-area>`), commit in your own folder.
2. Open a PR even if it's partial. One teammate reviews, then merge.
3. Run the app locally to check your part: see `frontend/README.md` (three terminals: node, seed, app).
4. Never commit `.env` or a private key.

## Demo order (so you know where your part shows up)

| Time | Beat |
|---|---|
| 0:00 | Cold open: patient page shows a recalled batch |
| 0:20 | Status: implemented / in progress / remaining |
| 0:55 | Contract verified on Amoy, app connects |
| 1:15 | Main flow: accept → hand off → accept → dispense → patient verify |
| 3:10 | Edge case: regulator recall turns the patient page red |
| 3:35 | Code walkthrough: contracts, then off-chain |
| 4:35 | Next steps and close |
