import { getAddress, isAddress, parseEther, formatEther, zeroAddress, type Address, type Hex } from "viem";
import { validateVaultReceipt, type GiftLifecycle, type GiftView } from "./chain";

/** Pure product rules for the frontend. No React, no network. */

export const MIN_DURATION_SECONDS = 3600;
export const MAX_DURATION_SECONDS = 30 * 24 * 3600;
/** The UI refuses the exact contract boundaries so block time drift cannot revert. */
export const EXPIRY_BUFFER_SECONDS = 3600;
export const MIN_HOURS = (MIN_DURATION_SECONDS + EXPIRY_BUFFER_SECONDS) / 3600;
export const MAX_HOURS = (MAX_DURATION_SECONDS - EXPIRY_BUFFER_SECONDS) / 3600;

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

export function sameAddress(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

export function formatBot(wei: bigint, maxDecimals = 4): string {
  const full = formatEther(wei);
  const [whole, frac = ""] = full.split(".");
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateRecipient(input: string, sender?: string | null): FieldResult<Address> {
  const value = input.trim();
  if (!value) return { ok: false, error: "Enter the wallet address of the person you are gifting." };
  if (!isAddress(value, { strict: false })) {
    return { ok: false, error: "That is not a valid wallet address. It should start with 0x and have 42 characters." };
  }
  const normalized = getAddress(value.toLowerCase());
  if (normalized === zeroAddress) return { ok: false, error: "The zero address cannot receive a gift." };
  if (sameAddress(normalized, sender)) {
    return { ok: false, error: "You cannot gift to your own wallet. Use the recipient's address." };
  }
  return { ok: true, value: normalized };
}

export function validateAmount(input: string): FieldResult<bigint> {
  const value = input.trim();
  if (!value) return { ok: false, error: "Enter how much BOT to send." };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(value)) return { ok: false, error: "Use numbers only, for example 0.5." };
  const [, frac = ""] = value.split(".");
  if (frac.length > 18) return { ok: false, error: "BOT supports at most 18 decimal places." };
  const normalized = value.startsWith(".") ? `0${value}` : value.endsWith(".") ? value.slice(0, -1) : value;
  const wei = parseEther(normalized);
  if (wei <= 0n) return { ok: false, error: "The amount must be more than zero." };
  return { ok: true, value: wei };
}

export function validateHours(input: string): FieldResult<number> {
  const value = input.trim();
  if (!/^\d+$/.test(value)) return { ok: false, error: "Enter a whole number of hours." };
  const hours = Number(value);
  if (hours < MIN_HOURS) {
    return { ok: false, error: `Choose at least ${MIN_HOURS} hours so the gift cannot expire before it lands.` };
  }
  if (hours > MAX_HOURS) return { ok: false, error: `Choose at most ${MAX_HOURS} hours, just under 30 days.` };
  return { ok: true, value: hours };
}

/** Expiry is based on the chain's latest block time, never the device clock. */
export function computeExpiry(chainNowSeconds: bigint, hours: number): bigint {
  return chainNowSeconds + BigInt(hours) * 3600n;
}

export function insufficientForGift(balance: bigint, amount: bigint, gasCost: bigint): boolean {
  return balance < amount + gasCost;
}

export type GiftAction =
  | "connect"
  | "claim"
  | "wrong-recipient"
  | "sender-waiting"
  | "reclaim"
  | "expired-view"
  | "none";

/**
 * Which action the visitor may see. Claim only for the nominated recipient on
 * a funded, unexpired gift. Reclaim only for the original sender after expiry.
 */
export function resolveGiftAction(
  account: string | undefined | null,
  gift: GiftView,
  lifecycle: GiftLifecycle
): GiftAction {
  if (lifecycle === "claimed" || lifecycle === "reclaimed" || lifecycle === "unset") return "none";
  if (lifecycle === "expired-awaiting-reclaim") {
    return sameAddress(account, gift.sender) ? "reclaim" : "expired-view";
  }
  if (!account) return "connect";
  if (sameAddress(account, gift.recipient)) return "claim";
  if (sameAddress(account, gift.sender)) return "sender-waiting";
  return "wrong-recipient";
}

export class ReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptError";
  }
}

interface ReceiptLike {
  status: string | null;
  logs: { address: string; data: Hex; topics: Hex[] }[];
}

/**
 * A creation receipt only counts when it succeeded and holds exactly one
 * GiftCreated event from the configured vault that matches what was funded.
 */
export function giftIdFromCreateReceipt(
  receipt: ReceiptLike,
  vault: string,
  expected: { sender: string; recipient: string; amount: bigint; metadataHash: string }
): bigint {
  const check = validateVaultReceipt(receipt, vault);
  if (!check.statusOk) throw new ReceiptError("The transaction did not succeed on chain.");
  const created = check.events.filter((e) => e.name === "GiftCreated");
  if (created.length !== 1) throw new ReceiptError("The receipt did not contain exactly one Wink gift event.");
  const args = created[0].args;
  const id = args.giftId;
  if (typeof id !== "bigint") throw new ReceiptError("The gift event had no gift ID.");
  if (
    !sameAddress(args.sender as string, expected.sender) ||
    !sameAddress(args.recipient as string, expected.recipient) ||
    args.amount !== expected.amount ||
    String(args.metadataHash).toLowerCase() !== expected.metadataHash.toLowerCase()
  ) {
    throw new ReceiptError("The gift event did not match the gift you funded.");
  }
  return id;
}

export function confirmActionReceipt(
  receipt: ReceiptLike,
  vault: string,
  eventName: "GiftClaimed" | "GiftReclaimed",
  giftId: bigint
): void {
  const check = validateVaultReceipt(receipt, vault);
  if (!check.statusOk) throw new ReceiptError("The transaction did not succeed on chain.");
  const hit = check.events.find((e) => e.name === eventName && e.args.giftId === giftId);
  if (!hit) throw new ReceiptError(`The receipt did not include the expected ${eventName} event.`);
}

export type TxErrorKind =
  | "rejected"
  | "insufficient-funds"
  | "wrong-network"
  | "rpc"
  | "already-claimed"
  | "expired"
  | "too-early"
  | "not-recipient"
  | "not-sender"
  | "revert"
  | "unknown";

export interface TxError {
  kind: TxErrorKind;
  message: string;
}

const MESSAGES: Record<TxErrorKind, string> = {
  rejected: "You closed the wallet request, so nothing was sent. You can try again whenever you like.",
  "insufficient-funds": "This wallet does not hold enough BOT for the amount plus network gas.",
  "wrong-network": "Your wallet is on a different network. Switch to the Wink network and try again.",
  rpc: "The BOT Chain network did not respond. Check your connection and try again in a moment.",
  "already-claimed": "This gift is no longer available. It has already been claimed or reclaimed.",
  expired: "This gift has expired, so it can no longer be claimed.",
  "too-early": "This gift has not expired yet, so it cannot be reclaimed.",
  "not-recipient": "This gift belongs to a different wallet address.",
  "not-sender": "Only the wallet that sent this gift can reclaim it.",
  revert: "The contract rejected this transaction.",
  unknown: "Something went wrong. Nothing was confirmed on chain.",
};

const REVERT_KIND: Record<string, TxErrorKind> = {
  NotFunded: "already-claimed",
  TooLate: "expired",
  TooEarly: "too-early",
  NotRecipient: "not-recipient",
  NotSender: "not-sender",
};

/** Classify a wallet, viem or contract error into a friendly, honest message. */
export function mapTxError(err: unknown): TxError {
  let kind: TxErrorKind = "unknown";
  let revertName: string | undefined;
  let cursor: unknown = err;
  for (let i = 0; i < 8 && cursor && typeof cursor === "object"; i++) {
    const e = cursor as {
      name?: string;
      code?: number;
      message?: string;
      shortMessage?: string;
      data?: { errorName?: string };
      cause?: unknown;
    };
    if (e.data?.errorName) revertName = e.data.errorName;
    const text = `${e.name ?? ""} ${e.shortMessage ?? ""} ${e.message ?? ""}`.toLowerCase();
    if (
      e.code === 4001 ||
      e.name === "UserRejectedRequestError" ||
      /user rejected|user denied|rejected the request/.test(text)
    ) {
      return { kind: "rejected", message: MESSAGES.rejected };
    }
    if (e.name === "InsufficientFundsError" || /insufficient funds|exceeds the balance/.test(text)) {
      kind = "insufficient-funds";
    } else if (e.name === "ChainMismatchError" || /does not match the target chain|chain mismatch/.test(text)) {
      kind = "wrong-network";
    } else if (
      kind === "unknown" &&
      (e.name === "HttpRequestError" ||
        e.name === "TimeoutError" ||
        e.name === "RpcRequestError" ||
        /failed to fetch|network request failed|timed out/.test(text))
    ) {
      kind = "rpc";
    }
    cursor = e.cause;
  }
  if (revertName === "SelfGift") return { kind: "revert", message: "You cannot gift to your own wallet." };
  if (revertName === "ExpiryTooSoon" || revertName === "ExpiryTooFar") {
    return { kind: "revert", message: "The expiry time was outside what the vault allows. Pick a duration and try again." };
  }
  if (revertName) kind = REVERT_KIND[revertName] ?? "revert";
  return { kind, message: MESSAGES[kind] };
}
