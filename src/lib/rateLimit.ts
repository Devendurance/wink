import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

/**
 * Rate limiting for the metadata API.
 *
 * Production uses a fixed-window counter in Neon so every Vercel instance shares
 * one count. The increment is a single atomic upsert. If the database cannot be
 * reached the limiter falls back to a per-instance in-memory window, so a
 * database blip degrades protection instead of breaking the product. Financial
 * custody never depends on these routes.
 */

export interface RateLimit {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  /** Atomically add one hit to the window and return the new total. */
  hit(key: string, windowStart: Date): Promise<number>;
  /** Delete counters from windows that ended before `before`. */
  prune(before: Date): Promise<void>;
}

// --- In-memory fallback (sliding window) -----------------------------------

const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxHits: number,
  windowSeconds: number,
  nowMs: number = Date.now()
): RateLimit {
  const windowMs = windowSeconds * 1000;
  const cutoff = nowMs - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= maxHits) {
    buckets.set(key, hits);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((hits[0] + windowMs - nowMs) / 1000)) };
  }
  hits.push(nowMs);
  buckets.set(key, hits);
  // Bound memory on a long-lived instance.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => t <= cutoff)) buckets.delete(k);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test hook. Not part of the production API surface. */
export function __resetRateLimits(): void {
  buckets.clear();
}

// --- Shared fixed-window limiter -------------------------------------------

/** Hash the limiter name and client address so raw IPs never reach the database. */
export function limiterKey(name: string, client: string): string {
  return createHash("sha256").update(`${name}|${client}`).digest("hex").slice(0, 32);
}

export function windowStartFor(nowMs: number, windowSeconds: number): Date {
  const w = windowSeconds * 1000;
  return new Date(Math.floor(nowMs / w) * w);
}

export async function checkSharedLimit(
  store: RateLimitStore,
  key: string,
  maxHits: number,
  windowSeconds: number,
  nowMs: number = Date.now()
): Promise<RateLimit> {
  const start = windowStartFor(nowMs, windowSeconds);
  const total = await store.hit(key, start);
  if (total <= maxHits) return { allowed: true, retryAfterSeconds: 0 };
  const endMs = start.getTime() + windowSeconds * 1000;
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((endMs - nowMs) / 1000)) };
}

class NeonRateLimitStore implements RateLimitStore {
  private db: ReturnType<typeof drizzle>;
  constructor(url: string) {
    this.db = drizzle(neon(url));
  }

  async hit(key: string, windowStart: Date): Promise<number> {
    const result = await this.db.execute(sql`
      INSERT INTO rate_limits (key, window_start, hits)
      VALUES (${key}, ${windowStart.toISOString()}::timestamptz, 1)
      ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
      RETURNING hits
    `);
    const rows = (result as unknown as { rows?: { hits: number }[] }).rows ?? (result as unknown as { hits: number }[]);
    const hits = Number(rows[0]?.hits);
    if (!Number.isFinite(hits)) throw new Error("Rate limit upsert returned no count.");
    return hits;
  }

  async prune(before: Date): Promise<void> {
    await this.db.execute(sql`DELETE FROM rate_limits WHERE window_start < ${before.toISOString()}::timestamptz`);
  }
}

let cachedStore: RateLimitStore | null = null;
let testStore: RateLimitStore | null | undefined;

/** Test hook. Pass null to force the memory fallback, undefined to restore Neon. */
export function __setRateLimitStoreForTests(store: RateLimitStore | null | undefined): void {
  testStore = store;
}

function getStore(): RateLimitStore | null {
  if (testStore !== undefined) return testStore;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cachedStore) cachedStore = new NeonRateLimitStore(url);
  return cachedStore;
}

const PRUNE_AFTER_MS = 24 * 3600 * 1000;
let lastPruneMs = 0;
const PRUNE_EVERY_MS = 10 * 60 * 1000;

/**
 * Limit a client for a named bucket. Shared across instances when the database
 * is available, per-instance otherwise. Never throws.
 */
export async function rateLimit(
  name: string,
  client: string,
  maxHits: number,
  windowSeconds: number,
  nowMs: number = Date.now()
): Promise<RateLimit & { shared: boolean }> {
  const store = getStore();
  if (store) {
    try {
      const result = await checkSharedLimit(store, limiterKey(name, client), maxHits, windowSeconds, nowMs);
      if (nowMs - lastPruneMs > PRUNE_EVERY_MS) {
        lastPruneMs = nowMs;
        // Fire and forget. Cleanup failure must not affect the request.
        void store.prune(new Date(nowMs - PRUNE_AFTER_MS)).catch(() => {});
      }
      return { ...result, shared: true };
    } catch {
      // Fall through to the local window.
    }
  }
  return { ...checkRateLimit(`${name}:${client}`, maxHits, windowSeconds, nowMs), shared: false };
}

// --- Client identification -------------------------------------------------

function validIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return v.length <= 64 && isIP(v) !== 0 ? v : null;
}

/**
 * Best client address available. Headers set by the hosting platform win over
 * client-supplied ones. On Vercel, x-vercel-forwarded-for and x-real-ip are
 * written by the edge and cannot be spoofed. x-forwarded-for is used last and
 * only its first entry, and every candidate must be a syntactically valid IP.
 * Otherwise the caller shares an "unknown" bucket.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const candidates = [
    headers.get("x-vercel-forwarded-for")?.split(",")[0],
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const c of candidates) {
    const ip = validIp(c);
    if (ip) return ip;
  }
  return "unknown";
}
