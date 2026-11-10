import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { giftMetadata } from "../../drizzle/schema";

export interface MetadataRecord {
  hash: string;
  canonical: string;
  createdAt: Date;
}

export class DatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export class MetadataConflictError extends Error {
  constructor(hash: string) {
    super(`Hash ${hash} already exists with different content.`);
    this.name = "MetadataConflictError";
  }
}

export interface MetadataStore {
  save(hash: string, canonical: string): Promise<MetadataRecord>;
  findByHash(hash: string): Promise<MetadataRecord | null>;
}

type NeonDb = ReturnType<typeof drizzle>;

class NeonMetadataStore implements MetadataStore {
  private db: NeonDb;

  constructor(connectionString: string) {
    this.db = drizzle(neon(connectionString));
  }

  async save(hash: string, canonical: string): Promise<MetadataRecord> {
    // One atomic insert. A concurrent duplicate hits ON CONFLICT and is read back
    // instead of failing on a unique violation.
    try {
      const rows = await this.db.insert(giftMetadata).values({ hash, canonical }).onConflictDoNothing().returning();
      if (rows[0]) return toRecord(rows[0]);
    } catch (err) {
      throw asUnavailable(err);
    }
    const existing = await this.findByHash(hash);
    if (!existing) throw new DatabaseUnavailableError("Insert conflicted but the row could not be read.");
    if (existing.canonical !== canonical) throw new MetadataConflictError(hash);
    return existing;
  }

  async findByHash(hash: string): Promise<MetadataRecord | null> {
    try {
      const rows = await this.db
        .select()
        .from(giftMetadata)
        .where(eq(giftMetadata.hash, hash))
        .limit(1);
      const row = rows[0];
      return row ? toRecord(row) : null;
    } catch (err) {
      throw asUnavailable(err);
    }
  }
}

function toRecord(row: { hash: string; canonical: string; createdAt: Date }): MetadataRecord {
  return { hash: row.hash, canonical: row.canonical, createdAt: row.createdAt };
}

function asUnavailable(err: unknown): Error {
  if (err instanceof MetadataConflictError) return err;
  if (err instanceof DatabaseUnavailableError) return err;
  const message = err instanceof Error ? err.message : "Unknown database error.";
  return new DatabaseUnavailableError(message);
}

let cached: MetadataStore | null = null;
let testOverride: MetadataStore | null = null;

/** Test hook. Routes use it when set, otherwise the Neon adapter. */
export function __setMetadataStoreForTests(store: MetadataStore | null): void {
  testOverride = store;
}

/** Production entrypoint. Throws DatabaseUnavailableError without DATABASE_URL. */
export function getMetadataStore(): MetadataStore {
  if (testOverride) return testOverride;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new DatabaseUnavailableError(
      "DATABASE_URL is not configured. Provision a Postgres database (Neon) and set DATABASE_URL."
    );
  }
  if (!cached) cached = new NeonMetadataStore(url);
  return cached;
}
