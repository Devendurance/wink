import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/metadata/route";
import { GET as GET_HEALTH } from "../../src/app/api/health/route";
import { createMetadataHash } from "../../src/lib/metadata";
import { __setMetadataStoreForTests, type MetadataStore } from "../../src/lib/metadataRepo";
import {
  __resetRateLimits,
  __setRateLimitStoreForTests,
  checkSharedLimit,
  clientIpFromHeaders,
  limiterKey,
  rateLimit,
  windowStartFor,
  type RateLimitStore,
} from "../../src/lib/rateLimit";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const guard = require("../../scripts/lib/deployGuard.js") as typeof import("../../scripts/lib/deployGuard.js");

const PAYLOAD = { v: 1, theme: "sunrise", note: "hello" };

function memoryStore(): MetadataStore {
  const map = new Map<string, { hash: string; canonical: string; createdAt: Date }>();
  return {
    async save(hash, canonical) {
      const existing = map.get(hash);
      if (existing) return existing;
      const rec = { hash, canonical, createdAt: new Date() };
      map.set(hash, rec);
      return rec;
    },
    async findByHash(hash) {
      return map.get(hash) ?? null;
    },
  };
}

/** Atomic counter standing in for the Neon upsert, shared by every "instance". */
function counterStore(): RateLimitStore & { rows: Map<string, number>; pruned: Date[] } {
  const rows = new Map<string, number>();
  const pruned: Date[] = [];
  return {
    rows,
    pruned,
    async hit(key, windowStart) {
      const k = `${key}@${windowStart.toISOString()}`;
      const next = (rows.get(k) ?? 0) + 1;
      rows.set(k, next);
      return next;
    },
    async prune(before) {
      pruned.push(before);
    },
  };
}

beforeEach(() => {
  __setRateLimitStoreForTests(null);
  __resetRateLimits();
  __setMetadataStoreForTests(memoryStore());
});

function req(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/metadata", { method: "POST", headers: { "x-forwarded-for": "10.9.0.1", ...headers }, body });
}

describe("metadata API hardening", () => {
  it("rejects oversized bodies with 413 whether or not Content-Length is declared", async () => {
    const big = JSON.stringify({ v: 1, theme: "sunrise", note: "x".repeat(20_000) });
    expect((await POST(req(big, { "content-length": String(big.length) }))).status).toBe(413);
    expect((await POST(req(big))).status).toBe(413);
  });

  it("still accepts a normal payload and rejects malformed JSON with 400", async () => {
    expect((await POST(req(JSON.stringify(PAYLOAD)))).status).toBe(200);
    expect((await POST(req("{nope"))).status).toBe(400);
  });

  it("serves identical concurrent requests with one stable hash", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => POST(req(JSON.stringify(PAYLOAD)))));
    const hashes = new Set<string>();
    for (const r of results) {
      expect(r.status).toBe(200);
      hashes.add(((await r.json()) as { hash: string }).hash);
    }
    expect(hashes).toEqual(new Set([createMetadataHash(PAYLOAD).hash]));
  });

  it("limits by the platform-set client address, not a spoofable x-forwarded-for", async () => {
    const mk = (xff: string) => POST(req(JSON.stringify(PAYLOAD), { "x-forwarded-for": xff, "x-vercel-forwarded-for": "203.0.113.7" }));
    for (let i = 0; i < 30; i++) expect((await mk(`1.2.3.${i}`)).status).toBe(200);
    const blocked = await mk("9.9.9.9");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("shared rate limiting", () => {
  it("counts atomically across instances using one shared store", async () => {
    const store = counterStore();
    const now = Date.UTC(2026, 10, 10, 12, 0, 30);
    const results = await Promise.all(Array.from({ length: 12 }, () => checkSharedLimit(store, "k", 10, 60, now)));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(results.filter((r) => !r.allowed)).toHaveLength(2);
  });

  it("reports retry-after to the end of the window and resets in the next window", async () => {
    const store = counterStore();
    const t0 = Date.UTC(2026, 10, 10, 12, 0, 40);
    for (let i = 0; i < 3; i++) await checkSharedLimit(store, "k", 3, 60, t0);
    const blocked = await checkSharedLimit(store, "k", 3, 60, t0);
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 20 });
    expect((await checkSharedLimit(store, "k", 3, 60, t0 + 21_000)).allowed).toBe(true);
    expect(windowStartFor(t0, 60).toISOString()).toBe("2026-11-10T12:00:00.000Z");
  });

  it("hashes client addresses so raw IPs are never stored", async () => {
    const store = counterStore();
    __setRateLimitStoreForTests(store);
    await rateLimit("metadata:post", "203.0.113.7", 5, 60);
    const keys = [...store.rows.keys()].join(" ");
    expect(keys).not.toContain("203.0.113.7");
    expect(limiterKey("a", "b")).toMatch(/^[0-9a-f]{32}$/);
    expect(limiterKey("a", "b")).not.toBe(limiterKey("a", "c"));
  });

  it("uses the shared store when available and prunes old windows", async () => {
    const store = counterStore();
    __setRateLimitStoreForTests(store);
    const r = await rateLimit("x", "1.1.1.1", 5, 60, Date.UTC(2030, 0, 1));
    expect(r.shared).toBe(true);
    await Promise.resolve();
    expect(store.pruned.length).toBeGreaterThan(0);
  });

  it("degrades to the in-memory limiter when the database fails, without throwing", async () => {
    __setRateLimitStoreForTests({
      async hit() {
        throw new Error("db down");
      },
      async prune() {},
    });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("fallback", "2.2.2.2", 3, 60));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[0].shared).toBe(false);
  });

  it("validates client addresses from headers", () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(clientIpFromHeaders(h({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "1.1.1.1" }))).toBe("203.0.113.7");
    expect(clientIpFromHeaders(h({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "<script>, 1.1.1.1" }))).toBe("unknown");
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIpFromHeaders(h({}))).toBe("unknown");
  });
});

describe("health readiness", () => {
  it("never calls an unconfigured mainnet ready and exposes no secrets", async () => {
    process.env.DATABASE_URL = "postgres://u:p4ssw0rd@host/db";
    const body = (await (await GET_HEALTH(new Request("http://localhost/api/health"))).json()) as {
      chains: { testnet: { configured: boolean; vaultAddress: string; deployBlock: string }; mainnet: { configured: boolean; vaultAddress: null; missing: string[] } };
      activeNetwork: string;
    };
    delete process.env.DATABASE_URL;
    expect(body.activeNetwork).toBe("testnet");
    expect(body.chains.mainnet.configured).toBe(false);
    expect(body.chains.mainnet.vaultAddress).toBeNull();
    expect(body.chains.mainnet.missing.join(" ")).toContain("NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_MAINNET");
    expect(body.chains.testnet).toMatchObject({ configured: true, vaultAddress: "0x61CB150B69baBa224A75F88307eAf9ce8B992c8E", deployBlock: "29949363" });
    expect(JSON.stringify(body)).not.toContain("p4ssw0rd");
  });
});

describe("deployment guardrails", () => {
  it("refuses a chain id that does not match the network", () => {
    expect(() => guard.assertExpectedChain("botchainMainnet", 968)).toThrow(/Chain ID mismatch/);
    expect(() => guard.assertExpectedChain("botchainTestnet", 677)).toThrow(/Chain ID mismatch/);
    expect(() => guard.assertExpectedChain("botchainMainnet", 677)).not.toThrow();
  });

  it("requires both chain id reads to agree", () => {
    expect(() => guard.assertConsistentChainIds("botchainMainnet", 677n, "0x1")).toThrow(/inconsistent/);
    expect(guard.assertConsistentChainIds("botchainMainnet", 677n, "0x2a5")).toBe(677);
  });

  it("will not deploy to mainnet without the exact acknowledgment phrase", () => {
    expect(() => guard.requireMainnetAck("botchainMainnet", {})).toThrow(/not acknowledged/);
    expect(() => guard.requireMainnetAck("botchainMainnet", { WINK_CONFIRM_MAINNET_DEPLOY: "yes" })).toThrow(/not acknowledged/);
    expect(() => guard.requireMainnetAck("botchainMainnet", { WINK_CONFIRM_MAINNET_DEPLOY: guard.MAINNET_ACK })).not.toThrow();
    // Testnet does not need it.
    expect(() => guard.requireMainnetAck("botchainTestnet", {})).not.toThrow();
  });

  it("refuses to overwrite a recorded deployment unless explicitly allowed", () => {
    const record = { address: "0x61CB150B69baBa224A75F88307eAf9ce8B992c8E" };
    expect(() => guard.assertNoOverwrite(record, {})).toThrow(/already recorded/);
    expect(() => guard.assertNoOverwrite(record, { WINK_ALLOW_REDEPLOY: "1" })).not.toThrow();
    expect(() => guard.assertNoOverwrite(null, {})).not.toThrow();
  });

  it("refuses an underfunded signer and describes signers without key material", () => {
    expect(() => guard.assertFunded(100n, 1000n)).toThrow(/below the estimated/);
    expect(guard.assertFunded(2000n, 1000n)).toBe(1250n);
    const summary = guard.describeSigner("0xabc", 5n);
    expect(Object.keys(summary).sort()).toEqual(["address", "balanceWei"]);
  });

  it("records the full deployment evidence and rejects failed receipts or missing code", () => {
    const base = {
      network: "botchainMainnet",
      chainId: 677,
      address: "0x1234567890abcdef1234567890abcdef12345678",
      txHash: "0x" + "ab".repeat(32),
      receipt: { status: 1, blockNumber: 30000000, gasUsed: 668487n },
      compiler: { solc: "0.8.28", optimizer: { enabled: true, runs: 200 } },
      codeExists: true,
      now: new Date("2026-12-01T00:00:00Z"),
    };
    const rec = guard.buildDeploymentRecord(base);
    expect(rec).toMatchObject({
      network: "botchainMainnet",
      chainId: 677,
      deploymentTx: base.txHash,
      receiptStatus: "success",
      block: 30000000,
      codeExists: true,
      verified: false,
      explorer: "https://scan.botchain.ai/address/0x1234567890abcdef1234567890abcdef12345678",
    });
    expect(rec.compiler).toEqual(base.compiler);
    expect(() => guard.buildDeploymentRecord({ ...base, receipt: { ...base.receipt, status: 0 } })).toThrow(/did not report success/);
    expect(() => guard.buildDeploymentRecord({ ...base, codeExists: false })).toThrow(/No contract code/);
    const verified = guard.markVerified(rec, { verified: true, url: "https://scan.botchain.ai/address/0x1234567890abcdef1234567890abcdef12345678#code" });
    expect(verified).toMatchObject({ verified: true, verificationUrl: expect.stringContaining("#code") });
  });

  it("detects owner, proxy, pause and upgrade features and passes the real contract", async () => {
    expect(guard.findForbiddenSourceFeatures("contract X is Ownable { }").length).toBeGreaterThan(0);
    expect(guard.findForbiddenSourceFeatures("function f() { addr.delegatecall(x); }").length).toBeGreaterThan(0);
    // Comments mentioning these words do not count.
    expect(guard.findForbiddenSourceFeatures("// no Ownable here\ncontract Y {}")).toEqual([]);
    const fs = await import("node:fs");
    const src = fs.readFileSync("contracts/WinkGiftVault.sol", "utf8");
    expect(guard.findForbiddenSourceFeatures(src)).toEqual([]);
  });
});

const liveDb = process.env.WINK_LIVE_DB === "1" ? describe : describe.skip;
liveDb("live Neon rate limiter", () => {
  it("counts atomically across concurrent hits against the real database", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("dotenv").config();
    __setRateLimitStoreForTests(undefined);
    const name = `live-test-${Date.now()}`;
    const results = await Promise.all(Array.from({ length: 8 }, () => rateLimit(name, "198.51.100.99", 5, 60)));
    expect(results.every((r) => r.shared)).toBe(true);
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  }, 60_000);
});
