import { NextResponse } from "next/server";
import { createMetadataHash, MetadataValidationError } from "@/lib/metadata";
import {
  DatabaseUnavailableError,
  MetadataConflictError,
  getMetadataStore,
} from "@/lib/metadataRepo";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rateLimit";

const MAX_POSTS_PER_WINDOW = 30;
const WINDOW_SECONDS = 600;

/**
 * Store public gift metadata and return its deterministic hash.
 * Idempotent: posting the same payload twice returns the same hash.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = clientIpFromHeaders(request.headers);
  const limit = checkRateLimit(`metadata:post:${ip}`, MAX_POSTS_PER_WINDOW, WINDOW_SECONDS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
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
