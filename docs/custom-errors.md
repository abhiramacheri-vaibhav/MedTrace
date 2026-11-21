# Contract custom errors: integration handoff

Owner: Maulik. Review requested from Neric before merging; Shrey can use the names below for `friendlyError`. These names are proposed by this branch and have not yet been agreed with teammates.

## Compatibility

This change replaces all 23 MedTrace revert strings with no-argument custom errors. Function signatures, events, storage layout, validation order and successful behavior are unchanged. Batch errors are declared on `IMedTrace`; participant errors are declared on `MedTraceAccess`. Both appear in the compiled `MedTrace` ABI. `BatchIsRecalled` deliberately differs from the existing `BatchRecalled` event.

The Amoy contract at `0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491` (deployed 2026-11-21) uses these custom errors; the earlier deployment at `0x2749c1613F6dfF8283434885b985d287AC5FA2B8` still uses revert strings. Sync the address **and ABI** together with `cd frontend && npm run sync-contract -- 0x194b7DdB2c70b89F8E8A312A9eaAdb8f6cb7A491 amoy`. Do not use the new ABI against the old deployment. Shrey should retain legacy message handling while adding custom-error decoding.

## Names and suggested messages

- `BatchNotFound()` — Batch not found.
- `CallerNotHolder()` — Caller is not the holder.
- `BatchIsRecalled()` — Batch is recalled.
- `BatchAlreadyDispensed()` — Batch already dispensed.
- `EmptyProductName()` — Empty product name.
- `EmptyLotNumber()` — Empty lot number.
- `ExpiryNotInFuture()` — Already expired.
- `InvalidTemperatureRange()` — Bad temperature range.
- `HandoffAlreadyInProgress()` — Hand-off already in progress.
- `CannotTransferToSelf()` — Cannot transfer to self.
- `InvalidReceiver()` — Receiver not a distributor or pharmacy.
- `BatchNotInTransit()` — Batch not in transit.
- `CallerNotReceiver()` — Caller is not the receiver.
- `BatchNotReceived()` — Batch not received yet.
- `BatchExpired()` — Batch expired.
- `TemperatureBreached()` — Temperature breached.
- `CallerNotHolderOrRegulator()` — Only holder or regulator.
- `EmptyCid()` — Empty CID.
- `ReadingWithinRange()` — Reading is within range.
- `BatchAlreadyCertified()` — Already certified.
- `RecallReasonRequired()` — Reason required.
- `ZeroAddress()` — Zero address.
- `UnknownRole()` — Unknown role.

OpenZeppelin errors remain unchanged: `AccessControlUnauthorizedAccount(address account, bytes32 neededRole)` and `AccessControlBadConfirmation()`. Solidity invalid-enum decoding and panic behavior also remain unchanged.

## Frontend decoding (Shrey)

Use ethers v6 `contract.interface.parseError(revertData)` with the synced ABI and map the returned `name` to the messages above. No MedTrace error has arguments. Some providers already supply `err.revert.name`; use it when available. Preserve wallet rejection, network failure, legacy string and unknown-error fallbacks. Never display a successful action when an error cannot be decoded.

## Test and deployment handoff (Neric)

- Assertions now use `revertedWithCustomError(medTrace, "ErrorName")`; existing AccessControl assertions are unchanged.
- PR #15 lifecycle tests also need `BatchExpired` for the expired-stock assertion and `CallerNotHolderOrRegulator` for former holders attaching documents. All 20 lifecycle tests pass after those two assertion migrations. Incorporate the same assertion migration into tests from PR #15. This branch does not replace that PR's coverage, lifecycle, README or deployment work.
- Review and agree the names before merge, then redeploy and verify Amoy, update README and frontend configuration, and reload demo wallets/batches as described in the team handoff.
- One reviewer is required before merge. Do not merge directly into `main` without review.
