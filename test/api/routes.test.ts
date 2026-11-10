import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/metadata/route";
import { GET as GET_ONE } from "../../src/app/api/metadata/[hash]/route";
import { GET as GET_HEALTH } from "../../src/app/api/health/route";
import { createMetadataHash } from "../../src/lib/metadata";
import {
  __setMetadataStoreForTests,
  type MetadataStore,
} from "../../src/lib/metadataRepo";
import { __resetRateLimits, __setRateLimitStoreForTests } from "../../src/lib/rateLimit";

function makeStore(): { store: MetadataStore; map: Map<string, { hash: string; canonical: string; createdAt: Date }> } {
  const map = new Map<string, { hash: string; canonical: string; createdAt: Date }>();
  const store: MetadataStore = {
    async save(hash, canonical) {
      const existing = map.get(hash);
      if (existing) {
        if (existing.canonical !== canonical) throw new Error("conflict-in-test");
        return existing;
      }
      const record = { hash, canonical, createdAt: new Date() };
      map.set(hash, record);
      return record;
    },
    async findByHash(hash) {
      return map.get(hash) ?? null;
    },
  };
  return { store, map };
}

function post(body: unknown, ip = "10.0.0.1"): Promise<Response> {
  return POST(
    new Request("http://localhost/api/metadata", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

function getOne(hash: string, ip = "10.0.0.2"): Promise<Response> {
  return GET_ONE(
    new Request(`http://localhost/api/metadata/${hash}`, {
      headers: { "x-forwarded-for": ip },
    }),
    { params: Promise.resolve({ hash }) }
  );
}

const PAYLOAD = { v: 1, theme: "sunrise", note: "hello wink" };

beforeEach(() => {
  __setRateLimitStoreForTests(null);
  __resetRateLimits();
  __setMetadataStoreForTests(makeStore().store);
});

describe("POST /api/metadata", () => {
  it("persists and returns the deterministic hash", async () => {
    const res = await post(PAYLOAD);
    expect(res.status).toBe(200);
    const body = await res.json();
    const expected = createMetadataHash(PAYLOAD);
    expect(body.hash).toBe(expected.hash);
    expect(body.metadata).toEqual(expected.metadata);
    expect(body.canonical).toBe(expected.canonical);
  });

  it("is idempotent for duplicate payloads", async () => {
    const first = await (await post(PAYLOAD)).json();
    const second = await (await post(PAYLOAD)).json();
    expect(second.hash).toBe(first.hash);
  });

  it("rejects invalid themes, malformed and oversized payloads", async () => {
    const themed = await post({ v: 1, theme: "volcano", note: "hi" });
    expect(themed.status).toBe(400);
    expect((await themed.json()).code).toBe("invalid_theme");

    const malformed = await post({ v: 1, theme: "sunrise" });
    expect(malformed.status).toBe(400);

    const oversized = await post({ v: 1, theme: "sunrise", note: "a".repeat(281) });
    expect(oversized.status).toBe(400);
    expect((await oversized.json()).code).toBe("note_too_long");

    const unsafe = await post({ v: 1, theme: "sunrise", note: "<script>alert(1)</script>" });
    expect(unsafe.status).toBe(400);

    const notJson = await POST(
      new Request("http://localhost/api/metadata", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.9" },
        body: "{oops",
      })
    );
    expect(notJson.status).toBe(400);
  });

  it("returns 503 when the database is unavailable", async () => {
    __setMetadataStoreForTests(null);
    delete process.env.DATABASE_URL;
    const res = await post(PAYLOAD, "10.0.0.50");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("metadata_store_unavailable");
  });

  it("rate limits abusive posting", async () => {
    const ip = "10.9.9.9";
    for (let i = 0; i < 30; i++) {
      const res = await post({ v: 1, theme: "sunrise", note: `gift ${i}` }, ip);
      expect(res.status).toBe(200);
    }
    const limited = await post(PAYLOAD, ip);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("GET /api/metadata/[hash]", () => {
  it("returns stored metadata after integrity verification", async () => {
    const created = await (await post(PAYLOAD, "10.0.1.1")).json();
    const res = await getOne(created.hash, "10.0.1.2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hash).toBe(created.hash);
    expect(body.metadata).toEqual(PAYLOAD);
  });

  it("returns 404 for unknown hashes", async () => {
    const res = await getOne("0x0000000000000000000000000000000000000000000000000000000000000001");
    expect(res.status).toBe(404);
  });

  it("rejects malformed hash params", async () => {
    expect((await getOne("0x123")).status).toBe(400);
    expect((await getOne("not-a-hash")).status).toBe(400);
  });

  it("never returns metadata that fails integrity verification", async () => {
    const { store, map } = makeStore();
    __setMetadataStoreForTests(store);
    const good = createMetadataHash(PAYLOAD);
    const other = createMetadataHash({ v: 1, theme: "confetti", note: "different" });
    map.set(good.hash, { hash: good.hash, canonical: other.canonical, createdAt: new Date() });
    const res = await getOne(good.hash, "10.0.1.3");
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("metadata_integrity_mismatch");
  });
});

describe("GET /api/health", () => {
  it("returns safe health info without secrets", async () => {
    process.env.PRIVATE_KEY = "0xdeadbeef-secret-in-test";
    process.env.DATABASE_URL = "postgres://user:s3cret@localhost:5432/db";
    const res = await GET_HEALTH(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("wink");
    expect(body.chains.testnet.chainId).toBe(968);
    expect(body.chains.mainnet.chainId).toBe(677);
    const text = JSON.stringify(body);
    expect(text).not.toContain("0xdeadbeef-secret-in-test");
    expect(text).not.toContain("s3cret");
    expect(text).not.toContain("PRIVATE_KEY");
    delete process.env.PRIVATE_KEY;
    delete process.env.DATABASE_URL;
  });
});
