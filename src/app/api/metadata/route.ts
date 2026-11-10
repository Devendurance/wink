import { NextResponse } from "next/server";
import { createMetadataHash, MetadataValidationError } from "@/lib/metadata";
import {
  DatabaseUnavailableError,
  MetadataConflictError,
  getMetadataStore,
} from "@/lib/metadataRepo";
import { clientIpFromHeaders, rateLimit } from "@/lib/rateLimit";

const MAX_POSTS_PER_WINDOW = 30;
const MAX_POSTS_GLOBAL = 1200;
const WINDOW_SECONDS = 600;
/** A valid payload is under 1.5 KB even with every character escaped. */
export const MAX_BODY_BYTES = 8 * 1024;

function tooLarge(): NextResponse {
  return NextResponse.json({ error: "payload_too_large", code: "payload_too_large" }, { status: 413 });
}

/**
 * Store public gift metadata and return its deterministic hash.
 * Idempotent: posting the same payload twice returns the same hash.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Reject oversize bodies before reading them when the client declares a length.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return tooLarge();

  const ip = clientIpFromHeaders(request.headers);
  const [perClient, global] = await Promise.all([
    rateLimit("metadata:post", ip, MAX_POSTS_PER_WINDOW, WINDOW_SECONDS),
    rateLimit("metadata:post:global", "all", MAX_POSTS_GLOBAL, WINDOW_SECONDS),
  ]);
  const limit = !perClient.allowed ? perClient : global;
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    const text = await request.text();
    // Content-Length can be absent or wrong, so measure the actual bytes too.
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return tooLarge();
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "malformed", code: "malformed" }, { status: 400 });
  }

  let result: ReturnType<typeof createMetadataHash>;
  try {
    result = createMetadataHash(body);
  } catch (err) {
    if (err instanceof MetadataValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    throw err;
  }

  try {
    await getMetadataStore().save(result.hash, result.canonical);
  } catch (err) {
    if (err instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: "metadata_store_unavailable" }, { status: 503 });
    }
    if (err instanceof MetadataConflictError) {
      return NextResponse.json({ error: "metadata_integrity_mismatch" }, { status: 500 });
    }
    throw err;
  }

  return NextResponse.json({
    hash: result.hash,
    metadata: result.metadata,
    canonical: result.canonical,
  });
}
