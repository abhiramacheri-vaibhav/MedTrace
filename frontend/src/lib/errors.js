// Turns a failed transaction into a sentence a person can act on.
// The contract rejects bad actions with named custom errors (see docs/custom-errors.md).
// ethers usually decodes them into err.revert.name; when a wallet wraps the error instead,
// we find the raw revert data and decode it with the contract's ABI ourselves.
// Kept free of Vite-only code so it can be tested with plain Node.
import { Interface } from "ethers";

// One plain sentence per contract error. TxButton adds "Nothing changed." after it.
export const ERROR_MESSAGES = {
  BatchNotFound: "That batch doesn't exist.",
  CallerNotHolder: "Only the account holding this batch can do that.",
  BatchIsRecalled: "This batch was recalled, so it can't change any more.",
  BatchAlreadyDispensed: "This batch was already given to a patient, so it can't change any more.",
  EmptyProductName: "Add a product name.",
  EmptyLotNumber: "Add a lot number.",
  ExpiryNotInFuture: "The expiry date has to be in the future.",
  InvalidTemperatureRange: "The lowest safe temperature has to be below the highest.",
  HandoffAlreadyInProgress: "This batch is already on its way to someone.",
  CannotTransferToSelf: "You can't hand a batch to yourself.",
  InvalidReceiver: "That account isn't a distributor or a pharmacy.",
  BatchNotInTransit: "This batch isn't on its way to anyone right now.",
  CallerNotReceiver: "This delivery is meant for a different account.",
  BatchNotReceived: "This batch hasn't been accepted yet.",
  BatchExpired: "This batch is past its expiry date.",
  TemperatureBreached: "This batch got too warm, so it can't go to a patient.",
  CallerNotHolderOrRegulator: "Only the account holding this batch, or the regulator, can add a document.",
  EmptyCid: "Add a document link first.",
  ReadingWithinRange: "That reading is inside the safe range, so there's nothing to report.",
  BatchAlreadyCertified: "This batch is already certified.",
  RecallReasonRequired: "Add a reason for the recall.",
  ZeroAddress: "That wallet address isn't valid.",
  UnknownRole: "That role doesn't exist.",
  // OpenZeppelin AccessControl
  AccessControlUnauthorizedAccount: "This account isn't allowed to do that.",
  AccessControlBadConfirmation: "This account isn't allowed to do that.",
};

// Wallets nest the revert data in different places; look a few levels deep for a 0x… string.
function findRevertData(err, depth = 0) {
  if (!err || typeof err !== "object" || depth > 4) return null;
  for (const key of ["data", "error", "info", "cause", "payload"]) {
    const v = err[key];
    if (typeof v === "string" && /^0x[0-9a-fA-F]{8}/.test(v)) return v;
    if (v && typeof v === "object") {
      if (typeof v.data === "string" && /^0x[0-9a-fA-F]{8}/.test(v.data)) return v.data;
      const inner = findRevertData(v, depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

/** The custom error's name, or "" when the failure isn't a contract error we can name. */
export function revertName(err, abi) {
  const direct = err?.revert?.name || err?.error?.revert?.name;
  if (direct) return direct;
  const data = findRevertData(err);
  if (data && abi) {
    try {
      const parsed = new Interface(abi).parseError(data);
      if (parsed) return parsed.name;
    } catch {
      /* not one of ours */
    }
  }
  // Last resort: a name in the message text, e.g. 'reverted with custom error "BatchExpired()"'.
  const text = `${err?.shortMessage || ""} ${err?.message || ""}`;
  const m = text.match(/\b([A-Z][A-Za-z]+)\(/g);
  const hit = m?.map((s) => s.slice(0, -1)).find((n) => ERROR_MESSAGES[n]);
  return hit || "";
}

export function friendlyError(err, abi) {
  const msg = err?.shortMessage || err?.reason || err?.message || String(err);
  if (err?.code === "ACTION_REJECTED" || /user rejected|ACTION_REJECTED|rejected the request|user denied/i.test(msg)) return "Your wallet app declined the request.";
  const name = revertName(err, abi);
  if (name && ERROR_MESSAGES[name]) return ERROR_MESSAGES[name];
  // Older deployments used text messages: "MedTrace: batch expired".
  const legacy = msg.match(/MedTrace: ([^"']+)/);
  if (legacy) return `The record refused it: ${legacy[1]}.`;
  if (/AccessControl/i.test(msg)) return ERROR_MESSAGES.AccessControlUnauthorizedAccount;
  if (/insufficient funds/i.test(msg)) return "This account has no test funds to pay for the transaction.";
  if (/could not coalesce|timeout|network/i.test(msg)) return "The blockchain didn't confirm in time.";
  if (/execution reverted|CALL_EXCEPTION|missing revert data/i.test(msg)) return "The record refused it.";
  return msg.length > 140 ? msg.slice(0, 137) + "…" : msg;
}
