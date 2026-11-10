/**
 * Minimal in-memory sliding-window rate limiter for the metadata API.
 * Practical abuse protection for a single-region MVP. Counts reset on
 * redeploy or cold start, which is acceptable because financial custody
 * never depends on these routes.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimit {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  maxHits: number,
  windowSeconds: number,
  nowMs: number = Date.now()
): RateLimit {
  const windowMs = windowSeconds * 1000;
  const cutoff = nowMs - windowMs;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
  if (bucket.hits.length >= maxHits) {
    const oldest = bucket.hits[0];
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000)) };
  }
  bucket.hits.push(nowMs);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test hook. Not part of the production API surface. */
export function __resetRateLimits(): void {
  buckets.clear();
}

/** First x-forwarded-for entry, or "unknown" when headers are absent. */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first.length > 0) return first.slice(0, 128);
  }
  return "unknown";
}
