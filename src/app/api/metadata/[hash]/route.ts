import { NextResponse } from "next/server";
import {
  canonicalizeMetadata,
  hashCanonicalMetadata,
  isMetadataHash,
  MetadataValidationError,
} from "@/lib/metadata";
import { DatabaseUnavailableError, getMetadataStore } from "@/lib/metadataRepo";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rateLimit";

const MAX_GETS_PER_WINDOW = 120;
const WINDOW_SECONDS = 60;

/** Fetch stored metadata by hash. Recomputes the hash before returning. */
export async function GET(
  request: Request,
  context: { params: Promise<{ hash: string }> }
): Promise<NextResponse> {
  const ip = clientIpFromHeaders(request.headers);
  const limit = checkRateLimit(`metadata:get:${ip}`, MAX_GETS_PER_WINDOW, WINDOW_SECONDS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { hash } = await context.params;
  if (!isMetadataHash(hash)) {
    return NextResponse.json({ error: "invalid_hash", code: "invalid_hash" }, { status: 400 });
  }

  let record: { hash: string; canonical: string } | null;
  try {
    record = await getMetadataStore().findByHash(hash);
  } catch (err) {
    if (err instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: "metadata_store_unavailable" }, { status: 503 });
    }
    throw err;
  }

  if (!record) {
    return NextResponse.json({ error: "metadata_not_found" }, { status: 404 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(record.canonical);
  } catch {
    return NextResponse.json({ error: "metadata_integrity_mismatch" }, { status: 500 });
  }

  try {
    const { canonical, metadata } = canonicalizeMetadata(parsed);
    if (canonical !== record.canonical || hashCanonicalMetadata(canonical).toLowerCase() !== hash.toLowerCase()) {
      return NextResponse.json({ error: "metadata_integrity_mismatch" }, { status: 500 });
    }
    return NextResponse.json({ hash, metadata, canonical });
  } catch (err) {
    if (err instanceof MetadataValidationError) {
      return NextResponse.json({ error: "metadata_integrity_mismatch" }, { status: 500 });
    }
    throw err;
  }
}
