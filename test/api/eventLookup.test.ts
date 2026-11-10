import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";
import {
  LogLookupError,
  __resetLookupCaches,
  classifyLogError,
  findProofTx,
  scanLogs,
  scanSentGifts,
  type ProofCache,
} from "../../src/lib/giftClient";

const VAULT = "0x61CB150B69baBa224A75F88307eAf9ce8B992c8E" as Address;
const SENDER = "0x1111111111111111111111111111111111111111" as Address;
const hash = (n: number) => ("0x" + n.toString(16).padStart(64, "0")) as Hex;
const noSleep = async () => {};
const httpError = () => Object.assign(new Error("fetch failed"), { name: "HttpRequestError" });

type Req = { fromBlock: bigint; toBlock: bigint; args?: Record<string, unknown> };
const log = (giftId: bigint, block: bigint, tx: number) => ({
  args: { giftId, recipient: "0x2222222222222222222222222222222222222222", amount: 5n, expiresAt: 9n },
  transactionHash: hash(tx),
  blockNumber: block,
  logIndex: 0,
});

function client(head: bigint, handler: (r: Req) => unknown[] | Promise<unknown[]>) {
  const calls: Req[] = [];
  const getLogs = vi.fn(async (r: Req) => {
    calls.push(r);
    return handler(r);
  });
  return { calls, getLogs, getBlockNumber: async () => head } as unknown as Parameters<typeof findProofTx>[0] & {
    calls: Req[];
    getLogs: ReturnType<typeof vi.fn>;
  };
}

const memCache = (): ProofCache => {
  const map = new Map<string, Hex>();
  return { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) };
};

beforeEach(() => __resetLookupCaches());

describe("error classification", () => {
  it("separates range limits from transient failures", () => {
    expect(classifyLogError(new Error("query returned more than 10000 results"))).toBe("range");
    expect(classifyLogError(new Error("block range is too large, limit exceeded"))).toBe("range");
    expect(classifyLogError(httpError())).toBe("transient");
    expect(classifyLogError(new Error("429 Too Many Requests"))).toBe("transient");
    expect(classifyLogError(new Error("execution reverted"))).toBe("other");
  });
});

describe("scanLogs", () => {
  it("halves the window on a range error and still covers every block exactly once", async () => {
    const seen: [bigint, bigint][] = [];
    const c = client(0n, ({ fromBlock, toBlock }) => {
      if (toBlock - fromBlock + 1n > 2500n) throw new Error("exceed max block range");
      seen.push([fromBlock, toBlock]);
      return [];
    });
    for await (const chunk of scanLogs(c, { address: VAULT, event: {} }, 1n, 10_000n, "forward", { chunk: 20_000n, sleep: noSleep })) {
      expect(chunk.to).toBeGreaterThanOrEqual(chunk.from);
    }
    expect(seen[0][0]).toBe(1n);
    expect(seen[seen.length - 1][1]).toBe(10_000n);
    for (let i = 1; i < seen.length; i++) expect(seen[i][0]).toBe(seen[i - 1][1] + 1n);
  });

  it("retries transient failures then succeeds", async () => {
    let n = 0;
    const c = client(0n, () => {
      if (n++ < 2) throw httpError();
      return [];
    });
    const out = [];
    for await (const chunk of scanLogs(c, { address: VAULT, event: {} }, 1n, 100n, "forward", { sleep: noSleep })) out.push(chunk);
    expect(out).toHaveLength(1);
    expect(n).toBe(3);
  });

  it("gives up with a typed error carrying the highest scanned block", async () => {
    const c = client(0n, ({ fromBlock }) => {
      if (fromBlock > 1000n) throw httpError();
      return [];
    });
    let caught: unknown;
    try {
      for await (const chunk of scanLogs(c, { address: VAULT, event: {} }, 1n, 5000n, "forward", { chunk: 1000n, retries: 1, sleep: noSleep })) {
        expect(chunk.from).toBeLessThanOrEqual(chunk.to);
      }
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LogLookupError);
    expect((caught as LogLookupError).kind).toBe("transient");
    expect((caught as LogLookupError).scannedThrough).toBe(1000n);
  });
});

describe("findProofTx", () => {
  it("queries only [deployBlock, head] on the vault with the indexed giftId, newest first", async () => {
    const c = client(50_000n, ({ fromBlock, toBlock }) => (fromBlock <= 46_000n && 46_000n <= toBlock ? [log(3n, 46_000n, 7)] : []));
    const found = await findProofTx(c, VAULT, 3n, "GiftClaimed", 30_000n, { chainId: 677, cache: memCache(), sleep: noSleep });
    expect(found).toBe(hash(7));
    expect(c.calls[0].toBlock).toBe(50_000n);
    expect(c.calls[0].args).toEqual({ giftId: 3n });
    for (const call of c.calls) expect(call.fromBlock >= 30_000n).toBe(true);
  });

  it("never fabricates a hash: no event means null", async () => {
    const c = client(1000n, () => []);
    expect(await findProofTx(c, VAULT, 0n, "GiftClaimed", 1n, { chainId: 968, cache: memCache(), sleep: noSleep })).toBeNull();
  });

  it("supports giftId 0 and ignores logs for other ids", async () => {
    const c = client(100n, () => [log(1n, 90n, 5), log(0n, 80n, 6)]);
    expect(await findProofTx(c, VAULT, 0n, "GiftCreated", 1n, { chainId: 968, cache: memCache(), sleep: noSleep })).toBe(hash(6));
  });

  it("shares one in-flight lookup and caches the verified hash", async () => {
    const cache = memCache();
    const c = client(100n, () => [log(2n, 60n, 9)]);
    const opts = { chainId: 968, cache, sleep: noSleep };
    const [a, b] = await Promise.all([
      findProofTx(c, VAULT, 2n, "GiftClaimed", 1n, opts),
      findProofTx(c, VAULT, 2n, "GiftClaimed", 1n, opts),
    ]);
    expect(a).toBe(hash(9));
    expect(b).toBe(hash(9));
    expect(c.getLogs).toHaveBeenCalledTimes(1);
    await findProofTx(c, VAULT, 2n, "GiftClaimed", 1n, opts);
    expect(c.getLogs).toHaveBeenCalledTimes(1);
  });

  it("keeps testnet and mainnet cache entries apart", async () => {
    const cache = memCache();
    await findProofTx(client(10n, () => [log(0n, 5n, 1)]), VAULT, 0n, "GiftCreated", 1n, { chainId: 968, cache, sleep: noSleep });
    const mainnet = client(10n, () => [log(0n, 5n, 2)]);
    expect(await findProofTx(mainnet, VAULT, 0n, "GiftCreated", 1n, { chainId: 677, cache, sleep: noSleep })).toBe(hash(2));
  });

  it("surfaces a failed historical lookup as an error, not a guess", async () => {
    const c = client(10n, () => {
      throw httpError();
    });
    await expect(findProofTx(c, VAULT, 0n, "GiftCreated", 1n, { chainId: 968, cache: memCache(), retries: 0, sleep: noSleep })).rejects.toBeInstanceOf(LogLookupError);
  });
});

describe("scanSentGifts", () => {
  it("filters by indexed sender, orders newest gift first and starts at the active deploy block", async () => {
    const c = client(10_000n, () => [log(0n, 100n, 1), log(2n, 300n, 3), log(1n, 200n, 2)]);
    const r = await scanSentGifts(c, VAULT, SENDER, 5000n, { sleep: noSleep });
    expect(r.gifts.map((g) => g.giftId)).toEqual([2n, 1n, 0n]);
    expect(c.calls[0].fromBlock).toBe(5000n);
    expect(c.calls[0].args).toEqual({ sender: SENDER });
    expect(r.complete).toBe(true);
    expect(r.toBlock).toBe(10_000n);
  });

  it("scans only newer blocks when given the previous complete result", async () => {
    const prev = await scanSentGifts(client(100n, () => [log(0n, 50n, 1)]), VAULT, SENDER, 1n, { sleep: noSleep });
    const second = client(150n, () => [log(1n, 120n, 2)]);
    const next = await scanSentGifts(second, VAULT, SENDER, 1n, { previous: prev, sleep: noSleep });
    expect(second.calls[0].fromBlock).toBe(101n);
    expect(next.gifts.map((g) => g.giftId)).toEqual([1n, 0n]);
  });

  it("returns partial results with an honest incomplete flag when the network fails mid scan", async () => {
    const c = client(5000n, ({ fromBlock }) => {
      if (fromBlock > 1000n) throw httpError();
      return [log(0n, 10n, 1)];
    });
    const r = await scanSentGifts(c, VAULT, SENDER, 1n, { chunk: 1000n, retries: 0, sleep: noSleep });
    expect(r.complete).toBe(false);
    expect(r.error).toBe("transient");
    expect(r.gifts).toHaveLength(1);
    expect(r.toBlock).toBe(1000n);
  });
});
