import type { Address, Hex, PublicClient } from "viem";
import { ChainReadError, normalizeGiftId, toGiftView, type GiftView } from "./chain";
import { canonicalizeMetadata, createMetadataHash, hashCanonicalMetadata, isMetadataHash, type GiftTheme, type PublicGiftMetadata } from "./metadata";
import { VAULT_ABI } from "./network";

/** Browser side chain reads and metadata API calls. Real reads only. */

type Reader = Pick<PublicClient, "readContract" | "getBlock">;

export interface GiftSnapshot {
  gift: GiftView;
  /** Latest block timestamp in seconds. Used for expiry checks, not the device clock. */
  chainNow: bigint;
}

export async function readGiftSnapshot(client: Reader, vault: Address, giftId: bigint | string): Promise<GiftSnapshot> {
  const id = normalizeGiftId(giftId);
  try {
    const [raw, block] = await Promise.all([
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: "getGift", args: [id] }),
      client.getBlock({ blockTag: "latest" }),
    ]);
    return { gift: toGiftView(id, raw), chainNow: block.timestamp };
  } catch (err) {
    if (err instanceof ChainReadError) throw err;
    const name = (err as { name?: string; message?: string })?.name ?? "";
    const text = `${(err as Error)?.message ?? ""}`;
    if (/UnknownGift/.test(text) || /UnknownGift/.test(JSON.stringify((err as { data?: unknown })?.data ?? ""))) {
      throw new ChainReadError("unknown_gift", "No gift with this ID exists in the Wink vault.");
    }
    // viem wraps a custom error revert inside the cause chain.
    let cursor: unknown = err;
    for (let i = 0; i < 8 && cursor && typeof cursor === "object"; i++) {
      const e = cursor as { data?: { errorName?: string }; cause?: unknown };
      if (e.data?.errorName === "UnknownGift") {
        throw new ChainReadError("unknown_gift", "No gift with this ID exists in the Wink vault.");
      }
      cursor = e.cause;
    }
    throw new ChainReadError("rpc_error", name ? `${name}: ${text.slice(0, 160)}` : "The network did not respond.");
  }
}

export type MetadataResult =
  | { status: "ok"; metadata: PublicGiftMetadata }
  | { status: "missing" }
  | { status: "unavailable" }
  | { status: "corrupted" };

/** Fetch metadata by the on-chain hash and re-verify it before trusting it. */
export async function fetchGiftMetadata(onChainHash: Hex, fetcher: typeof fetch = fetch): Promise<MetadataResult> {
  if (!isMetadataHash(onChainHash)) return { status: "corrupted" };
  let res: Response;
  try {
    res = await fetcher(`/api/metadata/${onChainHash}`);
  } catch {
    return { status: "unavailable" };
  }
  if (res.status === 404) return { status: "missing" };
  // The metadata route answers 500 only for an integrity mismatch.
  if (res.status === 500) return { status: "corrupted" };
  if (!res.ok) return { status: "unavailable" };
  try {
    const body = (await res.json()) as { canonical?: unknown };
    if (typeof body.canonical !== "string") return { status: "corrupted" };
    const parsed: unknown = JSON.parse(body.canonical);
    const { canonical, metadata } = canonicalizeMetadata(parsed);
    if (canonical !== body.canonical) return { status: "corrupted" };
    if (hashCanonicalMetadata(canonical).toLowerCase() !== onChainHash.toLowerCase()) return { status: "corrupted" };
    return { status: "ok", metadata };
  } catch {
    return { status: "corrupted" };
  }
}

export class MetadataSaveError extends Error {
  readonly kind: "unavailable" | "invalid" | "mismatch";
  constructor(kind: "unavailable" | "invalid" | "mismatch", message: string) {
    super(message);
    this.kind = kind;
  }
}

/** Store metadata through the real API and confirm its hash matches the local one. */
export async function saveGiftMetadata(
  input: { theme: GiftTheme; note: string },
  fetcher: typeof fetch = fetch
): Promise<Hex> {
  const local = createMetadataHash({ v: 1, theme: input.theme, note: input.note });
  let res: Response;
  try {
    res = await fetcher("/api/metadata", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(local.metadata),
    });
  } catch {
    throw new MetadataSaveError("unavailable", "We could not reach the message service. Your wallet was not asked for anything. Try again shortly.");
  }
  if (res.status === 400) throw new MetadataSaveError("invalid", "Your message was not accepted. Check the note and try again.");
  if (!res.ok) {
    throw new MetadataSaveError("unavailable", "The message service is unavailable right now. Nothing was sent from your wallet, so you can safely try again.");
  }
  const body = (await res.json()) as { hash?: string };
  if (!isMetadataHash(body.hash) || body.hash.toLowerCase() !== local.hash.toLowerCase()) {
    throw new MetadataSaveError("mismatch", "The message service returned an unexpected fingerprint. Nothing was sent from your wallet.");
  }
  return local.hash;
}

function eventAbi(name: "GiftCreated" | "GiftClaimed" | "GiftReclaimed"): never {
  return (VAULT_ABI as readonly { type: string; name?: string }[]).find(
    (x) => x.type === "event" && x.name === name
  ) as never;
}

/**
 * Find the real transaction that created, claimed or reclaimed a gift by
 * scanning the vault's indexed events. Returns null when none is found.
 */
export async function findProofTx(
  client: Pick<PublicClient, "getLogs" | "getBlockNumber">,
  vault: Address,
  giftId: bigint,
  eventName: "GiftCreated" | "GiftClaimed" | "GiftReclaimed",
  fromBlock: bigint,
  chunk = 20_000n
): Promise<Hex | null> {
  const head = await client.getBlockNumber();
  for (let start = fromBlock; start <= head; start += chunk) {
    const end = start + chunk - 1n > head ? head : start + chunk - 1n;
    const logs = await client.getLogs({ address: vault, event: eventAbi(eventName), args: { giftId } as never, fromBlock: start, toBlock: end });
    const hit = (logs as unknown as { transactionHash: Hex }[])[0];
    if (hit) return hit.transactionHash;
  }
  return null;
}

export interface SentGift {
  giftId: bigint;
  recipient: Address;
  amount: bigint;
  expiresAt: bigint;
  txHash: Hex;
}

/** Scan GiftCreated logs from the vault deploy block in chunks. Honest range is returned. */
export async function scanSentGifts(
  client: Pick<PublicClient, "getLogs" | "getBlockNumber">,
  vault: Address,
  sender: Address,
  fromBlock: bigint,
  chunk = 20_000n
): Promise<{ gifts: SentGift[]; fromBlock: bigint; toBlock: bigint }> {
  const head = await client.getBlockNumber();
  const gifts: SentGift[] = [];
  const createdEvent = eventAbi("GiftCreated");
  for (let start = fromBlock; start <= head; start += chunk) {
    const end = start + chunk - 1n > head ? head : start + chunk - 1n;
    const logs = await client.getLogs({ address: vault, event: createdEvent, args: { sender } as never, fromBlock: start, toBlock: end });
    for (const log of logs as unknown as { args: Record<string, unknown>; transactionHash: Hex }[]) {
      gifts.push({
        giftId: log.args.giftId as bigint,
        recipient: log.args.recipient as Address,
        amount: log.args.amount as bigint,
        expiresAt: log.args.expiresAt as bigint,
        txHash: log.transactionHash,
      });
    }
  }
  gifts.sort((a, b) => (a.giftId < b.giftId ? 1 : -1));
  return { gifts, fromBlock, toBlock: head };
}
