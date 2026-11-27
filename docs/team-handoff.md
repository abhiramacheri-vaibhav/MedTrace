# MedTrace: What's Left

Team BlockRx · CSE 540 · updated Fri 11/27

Only open tasks are listed. Everything else is merged on `main`.

## Dates

| Date | What |
|---|---|
| **Wed 11/25** | **Code freeze.** Only fixes after today, plus the demo data below. |
| Sun 11/29, 7 PM AZ | Team meeting: check the list below is empty |
| Mon 11/30 | Demo batches loaded on Amoy |
| Fri 12/04, 11:59 PM | Final project due (code, report, presentation) |

## Open tasks

### Vaibhav

| Task | By |
|---|---|
| Check that the regulator's recall still updates the patient page live on the new contract. | 11/27 |

### Neric

| Task | By |
|---|---|
| Load the demo batches onto the new contract (it has none yet): insulin `INS-2611-A` on its way to FastMed and certified, amoxicillin `AMX-2611-B` at FastMed and certified, and a sensor-test batch with a temperature alert. Add a few spares of each in case a take goes wrong. | 11/30 |
| Review Maulik's error names in `docs/custom-errors.md`. They're live, so only flag a name that's actually wrong. | 11/27 |

### Maulik

| Task | By |
|---|---|
| Once Neric is happy with the error names, update the top of `docs/custom-errors.md`, which still says the names are "proposed" and "not yet agreed". | 11/28 |

### Rohan

| Task | By |
|---|---|
| Try one real upload from the factory form with your upload key. It was only tested with a fake reply. | 11/27 |
| Revoke the upload key after the final recording. | 12/03 |

### Shrey

| Task | By |
|---|---|
| Final pass on every role page: wording, empty states, loading, phone screens. | 11/28 |

## Before you start

- **Repo:** https://github.com/abhiramacheri-vaibhav/MedTrace
- **Contract on Amoy:** `0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491` ([Polygonscan](https://amoy.polygonscan.com/address/0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491))
- **Point your app at it:** in `frontend/`, run `npm run sync-contract -- 0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491 amoy`
- **Run everything locally:** follow the README's Setup and Usage sections.
- **Secrets:** never commit `.env` or a private key. Ask Shrey for the demo wallet keys.
- **How we work:** a branch and a PR for each task, one reviewer, and `npx hardhat test` plus `cd frontend && npm run build` must pass first.
