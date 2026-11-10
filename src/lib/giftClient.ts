import type { Address, Hex, PublicClient } from "viem";
import { ChainReadError, normalizeGiftId, toGiftView, type GiftView } from "./chain";
import {
  canonicalizeMetadata,
  createMetadataHash,
  hashCanonicalMetadata,
  isMetadataHash,
  type GiftTheme,
  type PublicGiftMetadata,
} from "./metadata";
import { VAULT_ABI } from "./network";

/** Browser side chain reads and metadata API calls. Real reads only. */

type Reader = Pick<PublicClient, "readContract" | "getBlock">;

export interface GiftSnapshot {
  gift: GiftView;
  /** Latest block timestamp in seconds. Used for expiry checks, not the device clock. */
  chainNow: bigint;
}

function causeChain(err: unknown): { name?: string; message?: string; shortMessage?: string; data?: { errorName?: string }; cause?: unknown }[] {
  const out: { name?: string; message?: string; shortMessage?: string; data?: { errorName?: string }; cause?: unknown }[] = [];
  let cursor: unknown = err;
  for (let i = 0; i < 8 && cursor && typeof cursor === "object"; i++) {
    const e = cursor as { cause?: unknown };
    out.push(e as never);
    cursor = e.cause;
  }
  return out;
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
    for (const e of causeChain(err)) {
      if (e.data?.errorName === "UnknownGift" || /UnknownGift/.test(`${e.message ?? ""} ${e.shortMessage ?? ""}`)) {
        throw new ChainReadError("unknown_gift", "No gift with this ID exists in the Wink vault.");
      }
    }
    const name = (err as { name?: string })?.name ?? "";
    const text = `${(err as Error)?.message ?? ""}`;
    throw new ChainReadError("rpc_error", name ? `${name}: ${text.slice(0, 160)}` : "The network did not respond.");
  }
}

/**
 * Metadata outcomes. "corrupted" is reserved for evidence: the server said its
 * stored record failed its own hash check, or the content we received does not
 * hash to the on-chain value. Everything else is a service or format problem.
 */
export type MetadataResult =
  | { status: "ok"; metadata: PublicGiftMetadata }
  | { status: "missing" }
  | { status: "unavailable" }
  | { status: "malformed" }
  | { status: "corrupted" };

/** Fetch metadata by the on-chain hash and re-verify it before trusting it. */
export async function fetchGiftMetadata(onChainHash: Hex, fetcher: typeof fetch = fetch): Promise<MetadataResult> {
  if (!isMetadataHash(onChainHash)) return { status: "malformed" };
  let res: Response;
  try {
    res = await fetcher(`/api/metadata/${onChainHash}`);
  } catch {
    return { status: "unavailable" };
  }
  if (res.status === 404) return { status: "missing" };
  if (res.status === 400) return { status: "malformed" };
  if (!res.ok) {
    if (res.status === 500) {
      // Only an explicit integrity report from the server counts as corruption.
      try {
        const body = (await res.json()) as { error?: unknown };
        if (body?.error === "metadata_integrity_mismatch") return { status: "corrupted" };
      } catch {
        // Unreadable error body is a service problem, not evidence of corruption.
      }
    }
    return { status: "unavailable" };
  }
  let body: { canonical?: unknown };
  try {
    body = (await res.json()) as { canonical?: unknown };
  } catch {
    return { status: "malformed" };
  }
  if (typeof body.canonical !== "string") return { status: "malformed" };
  let canonical: string;
  let metadata: PublicGiftMetadata;
  try {
    ({ canonical, metadata } = canonicalizeMetadata(JSON.parse(body.canonical)));
  } catch {
    return { status: "malformed" };
  }
  // Valid shape that does not reproduce the on-chain fingerprint: verified mismatch.
  if (canonical !== body.canonical) return { status: "corrupted" };
  if (hashCanonicalMetadata(canonical).toLowerCase() !== onChainHash.toLowerCase()) return { status: "corrupted" };
  return { status: "ok", metadata };
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
  if (res.status === 400 || res.status === 413) throw new MetadataSaveError("invalid", "Your message was not accepted. Check the note and try again.");
  if (res.status === 429) {
    throw new MetadataSaveError("unavailable", "Too many gifts were saved from this network just now. Wait a minute and try again. Nothing was sent from your wallet.");
  }
  if (!res.ok) {
    throw new MetadataSaveError("unavailable", "The message service is unavailable right now. Nothing was sent from your wallet, so you can safely try again.");
  }
  const body = (await res.json()) as { hash?: string };
  if (!isMetadataHash(body.hash) || body.hash.toLowerCase() !== local.hash.toLowerCase()) {
    throw new MetadataSaveError("mismatch", "The message service returned an unexpected fingerprint. Nothing was sent from your wallet.");
  }
  return local.hash;
}

// ---------------------------------------------------------------------------
// Historical event lookup
// ---------------------------------------------------------------------------

export type LookupFailure = "range" | "transient" | "failed";

export class LogLookupError extends Error {
  readonly kind: LookupFailure;
  /** Highest block fully scanned before failing, when known. */
  readonly scannedThrough: bigint | null;
  constructor(kind: LookupFailure, message: string, scannedThrough: bigint | null = null) {
    super(message);
    this.name = "LogLookupError";
    this.kind = kind;
    this.scannedThrough = scannedThrough;
  }
}

/** Decide whether an RPC failure means "query window too large" or "try again". */
export function classifyLogError(err: unknown): "range" | "transient" | "other" {
  const text = causeChain(err)
    .map((e) => `${e.name ?? ""} ${e.shortMessage ?? ""} ${e.message ?? ""}`)
    .join(" ")
    .toLowerCase();
  if (/rate limit|too many requests|\b429\b|timeout|timed out|fetch failed|failed to fetch|network|econn|\b50[234]\b|temporarily|unavailable|httprequesterror|timeouterror/.test(text)) {
    return "transient";
  }
  if (/range|limit|too many|exceed|more than|response size|-32005|-32602|query returned/.test(text)) return "range";
  return "other";
}

type LogsClient = Pick<PublicClient, "getLogs" | "getBlockNumber">;

export interface ChunkOptions {
  chunk?: bigint;
  minChunk?: bigint;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface ScannedLogs {
  logs: { args: Record<string, unknown>; transactionHash: Hex; blockNumber: bigint; logIndex: number; removed?: boolean }[];
  from: bigint;
  to: bigint;
}

/**
 * Walk a block range in bounded windows. A "range too large" error halves the
 * window and retries the same blocks. Transient errors retry with backoff.
 * Direction "backward" starts at the newest block, which finds recent gifts
 * quickly. Throws LogLookupError carrying the highest fully scanned block.
 */
export async function* scanLogs(
  client: Pick<PublicClient, "getLogs">,
  base: { address: Address; event: unknown; args?: unknown },
  from: bigint,
  to: bigint,
  direction: "forward" | "backward",
  opts: ChunkOptions = {}
): AsyncGenerator<ScannedLogs> {
  let size = opts.chunk ?? 20_000n;
  const minChunk = opts.minChunk ?? 500n;
  const retries = opts.retries ?? 3;
  const sleep = opts.sleep ?? defaultSleep;
  let cursor = direction === "forward" ? from : to;
  let scanned: bigint | null = null;

  while (direction === "forward" ? cursor <= to : cursor >= from) {
    let start: bigint;
    let end: bigint;
    if (direction === "forward") {
      start = cursor;
      end = cursor + size - 1n > to ? to : cursor + size - 1n;
    } else {
      end = cursor;
      start = cursor - size + 1n < from ? from : cursor - size + 1n;
    }
    let attempt = 0;
    for (;;) {
      try {
        const logs = await client.getLogs({
          address: base.address,
          event: base.event,
          args: base.args,
          fromBlock: start,
          toBlock: end,
        } as never);
        yield { logs: logs as unknown as ScannedLogs["logs"], from: start, to: end };
        break;
      } catch (err) {
        const kind = classifyLogError(err);
        if (kind === "range" && size > minChunk) {
          size = size / 2n < minChunk ? minChunk : size / 2n;
          // Recompute the same window with the smaller size.
          if (direction === "forward") end = start + size - 1n > to ? to : start + size - 1n;
          else start = end - size + 1n < from ? from : end - size + 1n;
          continue;
        }
        if (kind === "transient" && attempt < retries) {
          attempt += 1;
          await sleep(250 * 2 ** attempt);
          continue;
        }
        throw new LogLookupError(
          kind === "range" ? "range" : kind === "transient" ? "transient" : "failed",
          kind === "range" ? "The network refuses a block range this small." : "The network did not answer the event query.",
          scanned
        );
      }
    }
    scanned = direction === "forward" ? end : start;
    cursor = direction === "forward" ? end + 1n : start - 1n;
  }
}

function eventAbi(name: "GiftCreated" | "GiftClaimed" | "GiftReclaimed"): unknown {
  return (VAULT_ABI as readonly { type: string; name?: string }[]).find((x) => x.type === "event" && x.name === name);
}

export type ProofEvent = "GiftCreated" | "GiftClaimed" | "GiftReclaimed";

export interface ProofCache {
  get(key: string): Hex | null;
  set(key: string, hash: Hex): void;
}

const memoryProofs = new Map<string, Hex>();
const STORAGE_PREFIX = "wink.proof.v1:";

/** Verified transaction hashes are immutable, so they are cached in memory and localStorage. */
export const defaultProofCache: ProofCache = {
  get(key) {
    const hit = memoryProofs.get(key);
    if (hit) return hit;
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_PREFIX + key) : null;
      if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) {
        memoryProofs.set(key, stored as Hex);
        return stored as Hex;
      }
    } catch {
      // Storage unavailable. Memory cache still works.
    }
    return null;
  },
  set(key, hash) {
    memoryProofs.set(key, hash);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_PREFIX + key, hash);
    } catch {
      // Ignore quota or privacy mode errors.
    }
  },
};

const inflight = new Map<string, Promise<Hex | null>>();

export interface ProofOptions extends ChunkOptions {
  chainId: number;
  cache?: ProofCache;
}

/**
 * Find the real transaction that created, claimed or reclaimed a gift. Filters
 * by the indexed giftId, scans newest to oldest inside bounded windows, caches
 * verified hits and shares one in-flight lookup per gift and event. Returns
 * null when no event exists in [fromBlock, head]. Throws LogLookupError when the
 * network cannot answer, never a made-up hash.
 */
export function findProofTx(
  client: LogsClient,
  vault: Address,
  giftId: bigint,
  eventName: ProofEvent,
  fromBlock: bigint,
  opts: ProofOptions
): Promise<Hex | null> {
  const key = `${opts.chainId}:${vault.toLowerCase()}:${giftId.toString()}:${eventName}`;
  const cache = opts.cache ?? defaultProofCache;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    const head = await client.getBlockNumber();
    if (head < fromBlock) return null;
    for await (const { logs } of scanLogs(
      client,
      { address: vault, event: eventAbi(eventName), args: { giftId } },
      fromBlock,
      head,
      "backward",
      opts
    )) {
      const hits = logs
        .filter((l) => !l.removed && l.args.giftId === giftId)
        .sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));
      if (hits[0]) {
        cache.set(key, hits[0].transactionHash);
        return hits[0].transactionHash;
      }
    }
    return null;
  })().finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

export interface SentGift {
  giftId: bigint;
  recipient: Address;
  amount: bigint;
  expiresAt: bigint;
  txHash: Hex;
}

export interface SentScan {
  gifts: SentGift[];
  fromBlock: bigint;
  /** Highest block that was fully searched. */
  toBlock: bigint;
  /** False when a failure stopped the scan early. Gifts found so far are still valid. */
  complete: boolean;
  error?: LookupFailure;
}

/**
 * Scan GiftCreated logs for one sender from the deployment block, using the
 * indexed sender filter. Pass the previous result to scan only newer blocks.
 */
export async function scanSentGifts(
  client: LogsClient,
  vault: Address,
  sender: Address,
  fromBlock: bigint,
  opts: ChunkOptions & { previous?: SentScan | null } = {}
): Promise<SentScan> {
  const head = await client.getBlockNumber();
  const prev = opts.previous && opts.previous.fromBlock === fromBlock && opts.previous.complete ? opts.previous : null;
  const start = prev ? prev.toBlock + 1n : fromBlock;
  const byId = new Map<string, SentGift>();
  for (const g of prev?.gifts ?? []) byId.set(g.giftId.toString(), g);
  let toBlock = prev ? prev.toBlock : fromBlock - 1n;
  let complete = true;
  let error: LookupFailure | undefined;

  if (start <= head) {
    try {
      for await (const chunk of scanLogs(client, { address: vault, event: eventAbi("GiftCreated"), args: { sender } }, start, head, "forward", opts)) {
        for (const log of chunk.logs) {
          if (log.removed) continue;
          const id = log.args.giftId as bigint;
          byId.set(id.toString(), {
            giftId: id,
            recipient: log.args.recipient as Address,
            amount: log.args.amount as bigint,
            expiresAt: log.args.expiresAt as bigint,
            txHash: log.transactionHash,
          });
        }
        toBlock = chunk.to;
      }
    } catch (err) {
      complete = false;
      error = err instanceof LogLookupError ? err.kind : "failed";
      if (err instanceof LogLookupError && err.scannedThrough !== null) toBlock = err.scannedThrough;
    }
  }
  const gifts = [...byId.values()].sort((a, b) => (a.giftId < b.giftId ? 1 : a.giftId > b.giftId ? -1 : 0));
  return { gifts, fromBlock, toBlock, complete, error };
}

/** Test hook. */
export function __resetLookupCaches(): void {
  memoryProofs.clear();
  inflight.clear();
}
