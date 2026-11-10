import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
