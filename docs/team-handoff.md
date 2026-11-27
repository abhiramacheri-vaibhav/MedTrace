# MedTrace: What's Left

Team BlockRx · CSE 540 · updated Fri 11/27

Only open tasks are listed. Everything else is merged on `main`.

## Dates

| Date | What |
|---|---|
| Sun 11/29, 7 PM AZ | Team meeting: check the list below is empty, read the report draft together |
| Tue 12/02 | Record the final presentation |
| Fri 12/04, 11:59 PM | Final project due (code, report, presentation) |

## Done since Wednesday (no action needed)

- **QR codes** on every batch card (Vaibhav, #22).
- **Demo batches loaded** on the current Amoy contract (`0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491`):

  | Batch | Lot | State |
  |---|---|---|
  | #1 | `INS-2611-A` Insulin | Certified, on its way to FastMed (demo starts at "Accept delivery") |
  | #2 | `AMX-2611-B` Amoxicillin | Certified, at FastMed (for the recall) |
  | #3 | `SENSOR-TEST-001` | Registered at Acme, waiting for a sensor alert |
  | #4 | `INS-2611-C` Insulin | Spare copy of #1 |
  | #5 | `AMX-2611-D` Amoxicillin | Spare copy of #2 |

  The patient page shows the newest batch for a lot, so the spares have their own lot numbers. If a take uses a spare, say its lot instead.
- **Live recall checked** on the current contract code: the patient page turns to "Do not use" by itself within about 4 seconds and shows the reason.
- **`docs/custom-errors.md`** now says the error names are final (PR #23, merged).

## Open tasks

### Neric

| Task | By |
|---|---|
| Give the sensor wallet `SENSOR_ROLE` on the new contract (Admin page or `registerParticipant`). Only the admin wallet can do this, and batch #3 needs it. | 11/29 |
| If you haven't yet, look over the error names in `docs/custom-errors.md`. They're live, so only flag one that's actually wrong. | 11/29 |
| Check your Results and gas sections of the report draft. | 11/29 |

### Rohan

| Task | By |
|---|---|
| Once Neric has granted the role, run the sensor once on Amoy: `BATCH_ID=3 npm run iot:simulate` (setup in README section 7). | 11/30 |
| Try one real upload from the factory form with your upload key (only tested with a fake reply so far). | 11/30 |
| Check your IPFS and sensor sections of the report draft. Revoke the upload key after the final recording. | 11/29, 12/03 |

### Maulik

| Task | By |
|---|---|
| Check your contract logic and storage sections of the report draft. | 11/29 |

### Vaibhav

| Task | By |
|---|---|
| Check your access control, patient page and privacy sections of the report draft. | 11/29 |

### Shrey

| Task | By |
|---|---|
| Final pass on every role page: wording, empty states, loading, phone screens. | 11/28 |
| Final edit of the report and the presentation script. | 12/01 |

## Before you start

- **Repo:** https://github.com/abhiramacheri-vaibhav/MedTrace
- **Contract on Amoy:** `0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491` ([Polygonscan](https://amoy.polygonscan.com/address/0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491))
- **Point your app at it:** in `frontend/`, run `npm run sync-contract -- 0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491 amoy`
- **Demo wallets:** Acme Pharma has only about 0.02 POL left. Don't use it for anything outside the demo; ask Shrey if it needs topping up.
- **Secrets:** never commit `.env` or a private key. Ask Shrey for the demo wallet keys.
- **How we work:** a branch and a PR for each task, one reviewer, and `npx hardhat test` plus `cd frontend && npm run build` must pass first.
