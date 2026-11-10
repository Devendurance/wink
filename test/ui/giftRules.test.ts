import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, keccak256, toBytes, type Address, type Hex } from "viem";
import { deriveLifecycle, type GiftView } from "@/lib/chain";
import { fetchGiftMetadata, saveGiftMetadata, MetadataSaveError } from "@/lib/giftClient";
import {
  MAX_HOURS,
  MIN_HOURS,
  ReceiptError,
  computeExpiry,
  confirmActionReceipt,
  giftIdFromCreateReceipt,
  insufficientForGift,
  mapTxError,
  resolveGiftAction,
  validateAmount,
  validateHours,
  validateRecipient,
} from "@/lib/giftRules";
import { createMetadataHash } from "@/lib/metadata";
import { VAULT_ABI } from "@/lib/network";

const VAULT = "0x61CB150B69baBa224A75F88307eAf9ce8B992c8E" as Address;
const SENDER = "0x1111111111111111111111111111111111111111" as Address;
const RECIPIENT = "0x2222222222222222222222222222222222222222" as Address;
const STRANGER = "0x3333333333333333333333333333333333333333" as Address;

function eventLog(name: "GiftCreated" | "GiftClaimed" | "GiftReclaimed", giftId: bigint, o: { amount?: bigint; hash?: Hex; address?: string } = {}) {
  const amount = o.amount ?? 10n ** 16n;
  if (name === "GiftCreated") {
    const topics = encodeEventTopics({ abi: VAULT_ABI, eventName: name, args: { giftId, sender: SENDER, recipient: RECIPIENT } as never });
    const data = encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint64" }, { type: "bytes32" }],
      [amount, 1_900_000_000n, o.hash ?? keccak256(toBytes("x"))]
    );
    return { address: o.address ?? VAULT, data, topics: topics as Hex[] };
  }
  const who = name === "GiftClaimed" ? RECIPIENT : SENDER;
  const topics = encodeEventTopics({ abi: VAULT_ABI, eventName: name, args: (name === "GiftClaimed" ? { giftId, recipient: who } : { giftId, sender: who }) as never });
  const data = encodeAbiParameters([{ type: "uint256" }], [amount]);
  return { address: o.address ?? VAULT, data, topics: topics as Hex[] };
}

const gift = (over: Partial<GiftView> = {}): GiftView => ({
  giftId: 0n,
  sender: SENDER,
  recipient: RECIPIENT,
  amount: 10n ** 16n,
  expiresAt: 2000n,
  metadataHash: keccak256(toBytes("m")),
  state: "funded",
  ...over,
});

describe("recipient validation", () => {
  it("accepts a valid address and normalizes checksum", () => {
    const r = validateRecipient(RECIPIENT.toLowerCase(), SENDER);
    expect(r.ok).toBe(true);
  });
  it.each([["", "Enter"], ["0x123", "not a valid"], ["hello", "not a valid"], ["0x0000000000000000000000000000000000000000", "zero address"]])(
    "rejects %j",
    (input, fragment) => {
      const r = validateRecipient(input, SENDER);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(fragment);
    }
  );
  it("rejects gifting to yourself", () => {
    const r = validateRecipient(SENDER.toUpperCase().replace("0X", "0x"), SENDER);
    expect(r.ok).toBe(false);
  });
});

describe("amount validation", () => {
  it("parses decimals to wei", () => {
    const r = validateAmount("0.5");
    expect(r).toEqual({ ok: true, value: 5n * 10n ** 17n });
    expect(validateAmount(".25")).toEqual({ ok: true, value: 25n * 10n ** 16n });
  });
  it.each(["", "abc", "0", "0.0", "-1", "1e3", "1.1234567890123456789"])("rejects %j", (v) => {
    expect(validateAmount(v).ok).toBe(false);
  });
});

describe("expiry rules", () => {
  it("refuses the exact contract boundaries", () => {
    expect(MIN_HOURS).toBeGreaterThan(1);
    expect(MAX_HOURS).toBeLessThan(720);
    expect(validateHours("1").ok).toBe(false);
    expect(validateHours(String(MIN_HOURS)).ok).toBe(true);
    expect(validateHours(String(MAX_HOURS)).ok).toBe(true);
    expect(validateHours("720").ok).toBe(false);
    expect(validateHours("1.5").ok).toBe(false);
    expect(validateHours("").ok).toBe(false);
  });
  it("keeps a submission-time buffer at both ends relative to chain time", () => {
    const now = 1_000_000n;
    const min = computeExpiry(now, MIN_HOURS) - now;
    const max = computeExpiry(now, MAX_HOURS) - now;
    expect(min).toBeGreaterThanOrEqual(3600n + 3600n);
    expect(max).toBeLessThanOrEqual(30n * 86400n - 3600n);
  });
  it("detects insufficient balance with gas", () => {
    expect(insufficientForGift(10n, 10n, 1n)).toBe(true);
    expect(insufficientForGift(11n, 10n, 1n)).toBe(false);
  });
});

describe("metadata hash correctness", () => {
  it("hash equals keccak256 of the canonical bytes", () => {
    const r = createMetadataHash({ v: 1, theme: "sunrise", note: "Happy birthday" });
    expect(r.hash).toBe(keccak256(toBytes(r.canonical)));
    expect(r.canonical).toBe('{"v":1,"theme":"sunrise","note":"Happy birthday"}');
  });
  it("saveGiftMetadata rejects a mismatched service hash", async () => {
    const fetcher = (async () => new Response(JSON.stringify({ hash: keccak256(toBytes("other")) }), { status: 200 })) as typeof fetch;
    await expect(saveGiftMetadata({ theme: "confetti", note: "hi" }, fetcher)).rejects.toMatchObject({ kind: "mismatch" });
  });
  it("saveGiftMetadata reports an unavailable service", async () => {
    const down = (async () => new Response("{}", { status: 503 })) as typeof fetch;
    await expect(saveGiftMetadata({ theme: "confetti", note: "hi" }, down)).rejects.toBeInstanceOf(MetadataSaveError);
    const offline = (async () => {
      throw new TypeError("failed");
    }) as typeof fetch;
    await expect(saveGiftMetadata({ theme: "confetti", note: "hi" }, offline)).rejects.toMatchObject({ kind: "unavailable" });
  });
  it("saveGiftMetadata returns the confirmed hash", async () => {
    const local = createMetadataHash({ v: 1, theme: "night-sky", note: "ok" });
    const fetcher = (async () => new Response(JSON.stringify({ hash: local.hash }), { status: 200 })) as typeof fetch;
    await expect(saveGiftMetadata({ theme: "night-sky", note: "ok" }, fetcher)).resolves.toBe(local.hash);
  });
});

describe("missing or corrupted metadata fallback", () => {
  const good = createMetadataHash({ v: 1, theme: "sunrise", note: "hello" });
  const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
  it("returns ok when canonical re-hashes to the on-chain hash", async () => {
    const r = await fetchGiftMetadata(good.hash, respond(200, { canonical: good.canonical }));
    expect(r).toEqual({ status: "ok", metadata: good.metadata });
  });
  it("maps 404 to missing, 503 to unavailable, a network error to unavailable", async () => {
    expect(await fetchGiftMetadata(good.hash, respond(404, {}))).toEqual({ status: "missing" });
    expect(await fetchGiftMetadata(good.hash, respond(503, {}))).toEqual({ status: "unavailable" });
    const offline = (async () => {
      throw new TypeError("x");
    }) as typeof fetch;
    expect(await fetchGiftMetadata(good.hash, offline)).toEqual({ status: "unavailable" });
  });
  it("treats content that does not match the on-chain hash as corrupted", async () => {
    const other = createMetadataHash({ v: 1, theme: "sunrise", note: "tampered" });
    expect(await fetchGiftMetadata(good.hash, respond(200, { canonical: other.canonical }))).toEqual({ status: "corrupted" });
    expect(await fetchGiftMetadata(good.hash, respond(200, { canonical: "{not json" }))).toEqual({ status: "corrupted" });
    expect(await fetchGiftMetadata(good.hash, respond(500, {}))).toEqual({ status: "corrupted" });
  });
});

describe("creation receipt verification", () => {
  const hash = keccak256(toBytes("meta"));
  const expected = { sender: SENDER, recipient: RECIPIENT, amount: 10n ** 16n, metadataHash: hash };

  it("extracts giftId 0 from a confirmed GiftCreated event", () => {
    const id = giftIdFromCreateReceipt({ status: "success", logs: [eventLog("GiftCreated", 0n, { hash })] }, VAULT, expected);
    expect(id).toBe(0n);
  });
  it("extracts a later giftId", () => {
    expect(giftIdFromCreateReceipt({ status: "success", logs: [eventLog("GiftCreated", 7n, { hash })] }, VAULT, expected)).toBe(7n);
  });
  it("rejects reverted receipts, missing events, foreign contracts, duplicates and mismatches", () => {
    const ok = eventLog("GiftCreated", 0n, { hash });
    expect(() => giftIdFromCreateReceipt({ status: "reverted", logs: [ok] }, VAULT, expected)).toThrow(ReceiptError);
    expect(() => giftIdFromCreateReceipt({ status: "success", logs: [] }, VAULT, expected)).toThrow(ReceiptError);
    expect(() => giftIdFromCreateReceipt({ status: "success", logs: [eventLog("GiftCreated", 0n, { hash, address: STRANGER })] }, VAULT, expected)).toThrow(ReceiptError);
    expect(() => giftIdFromCreateReceipt({ status: "success", logs: [ok, ok] }, VAULT, expected)).toThrow(ReceiptError);
    expect(() => giftIdFromCreateReceipt({ status: "success", logs: [eventLog("GiftCreated", 0n, { hash, amount: 5n })] }, VAULT, expected)).toThrow(ReceiptError);
    expect(() => giftIdFromCreateReceipt({ status: "success", logs: [eventLog("GiftClaimed", 0n)] }, VAULT, expected)).toThrow(ReceiptError);
  });
  it("confirms claim and reclaim receipts only for the right event and gift", () => {
    expect(() => confirmActionReceipt({ status: "success", logs: [eventLog("GiftClaimed", 0n)] }, VAULT, "GiftClaimed", 0n)).not.toThrow();
    expect(() => confirmActionReceipt({ status: "success", logs: [eventLog("GiftClaimed", 1n)] }, VAULT, "GiftClaimed", 0n)).toThrow(ReceiptError);
    expect(() => confirmActionReceipt({ status: "success", logs: [eventLog("GiftReclaimed", 0n)] }, VAULT, "GiftClaimed", 0n)).toThrow(ReceiptError);
    expect(() => confirmActionReceipt({ status: "success", logs: [eventLog("GiftReclaimed", 0n)] }, VAULT, "GiftReclaimed", 0n)).not.toThrow();
  });
});

describe("recipient-only claim and sender-only reclaim", () => {
  const act = (account: string | null, g: GiftView, now: bigint) => resolveGiftAction(account, g, deriveLifecycle(g, now));
  it("offers claim only to the recipient on a funded, unexpired gift", () => {
    const g = gift();
    expect(act(RECIPIENT, g, 1000n)).toBe("claim");
    expect(act(RECIPIENT.toLowerCase(), g, 1000n)).toBe("claim");
    expect(act(STRANGER, g, 1000n)).toBe("wrong-recipient");
    expect(act(SENDER, g, 1000n)).toBe("sender-waiting");
    expect(act(null, g, 1000n)).toBe("connect");
  });
  it("offers reclaim only to the sender after expiry, including at the exact boundary", () => {
    const g = gift();
    expect(act(SENDER, g, 2000n)).toBe("reclaim");
    expect(act(SENDER, g, 1999n)).toBe("sender-waiting");
    expect(act(RECIPIENT, g, 2500n)).toBe("expired-view");
    expect(act(STRANGER, g, 2500n)).toBe("expired-view");
    expect(act(null, g, 2500n)).toBe("expired-view");
  });
  it("offers nothing once claimed or reclaimed", () => {
    expect(act(RECIPIENT, gift({ state: "claimed" }), 1000n)).toBe("none");
    expect(act(SENDER, gift({ state: "reclaimed" }), 5000n)).toBe("none");
  });
});

describe("transaction error mapping", () => {
  it("maps wallet rejection", () => {
    expect(mapTxError({ name: "UserRejectedRequestError", message: "User rejected the request." }).kind).toBe("rejected");
    expect(mapTxError({ code: 4001, message: "x" }).kind).toBe("rejected");
  });
  it("maps insufficient funds, wrong network and RPC failures", () => {
    expect(mapTxError({ name: "InsufficientFundsError", message: "" }).kind).toBe("insufficient-funds");
    expect(mapTxError({ name: "ChainMismatchError", message: "" }).kind).toBe("wrong-network");
    expect(mapTxError({ name: "HttpRequestError", message: "" }).kind).toBe("rpc");
  });
  it("maps contract reverts found deep in the cause chain", () => {
    const wrap = (errorName: string) => ({ name: "ContractFunctionExecutionError", message: "", cause: { name: "ContractFunctionRevertedError", message: "", data: { errorName } } });
    expect(mapTxError(wrap("NotFunded")).kind).toBe("already-claimed");
    expect(mapTxError(wrap("TooLate")).kind).toBe("expired");
    expect(mapTxError(wrap("TooEarly")).kind).toBe("too-early");
    expect(mapTxError(wrap("NotRecipient")).kind).toBe("not-recipient");
    expect(mapTxError(wrap("SelfGift")).kind).toBe("revert");
    expect(mapTxError(new Error("???")).kind).toBe("unknown");
  });
});
