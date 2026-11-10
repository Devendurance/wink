import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Canonical public gift metadata keyed by its keccak256 hash.
 * The hash is the primary key so writes are naturally idempotent and
 * any content change yields a different row instead of silent mutation.
 */
export const giftMetadata = pgTable("gift_metadata", {
  hash: text("hash").primaryKey(),
  canonical: text("canonical").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type GiftMetadataRow = typeof giftMetadata.$inferSelect;

/**
 * Fixed-window request counters shared by every serverless instance.
 * One row per (key, window). The key is a hash of the limiter name and the
 * client address, so raw IPs are never stored. Old windows are deleted
 * opportunistically, which keeps the table small.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    hits: integer("hits").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })]
);
