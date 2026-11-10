import { keccak256, toBytes } from "viem";

/**
 * Public gift metadata. Display data only, never private or encrypted.
 * The keccak256 of the canonical form is stored on chain as metadataHash.
 */

export const METADATA_VERSION = 1 as const;

export const GIFT_THEMES = ["sunrise", "confetti", "night-sky"] as const;
export type GiftTheme = (typeof GIFT_THEMES)[number];

export const MAX_NOTE_CHARS = 280;

export interface PublicGiftMetadata {
  v: 1;
  theme: GiftTheme;
  note: string;
}

export type MetadataHash = `0x${string}`;

export class MetadataValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MetadataValidationError";
    this.code = code;
  }
}

/**
 * Canonical serialization: fixed key order v, theme, note, JSON stringified.
 * Both the backend and the frontend must build exactly this byte sequence
 * before hashing. Unicode text is NFC normalized before serialization.
 */
export function canonicalizeMetadata(input: unknown): {
  canonical: string;
  metadata: PublicGiftMetadata;
} {
  const metadata = validateMetadata(input);
  const canonical =
    `{"v":${metadata.v},` +
    `"theme":${JSON.stringify(metadata.theme)},` +
    `"note":${JSON.stringify(metadata.note)}}`;
  return { canonical, metadata };
}

/** keccak256 over the canonical UTF-8 bytes. Matches the on-chain bytes32. */
export function hashCanonicalMetadata(canonical: string): MetadataHash {
  return keccak256(toBytes(canonical));
}

/** Full pipeline: validate, normalize, serialize, hash. */
export function createMetadataHash(input: unknown): {
  hash: MetadataHash;
  canonical: string;
  metadata: PublicGiftMetadata;
} {
  const { canonical, metadata } = canonicalizeMetadata(input);
  return { hash: hashCanonicalMetadata(canonical), canonical, metadata };
}

/** Strict 0x-prefixed 32-byte hex check for hash path params and payloads. */
export function isMetadataHash(value: unknown): value is MetadataHash {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

// Control characters, deletes, C1 controls, zero-width and format marks,
// bidi overrides and isolates, and BOM. Newline and tab are stripped by the
// caller before this test so multi-line notes stay allowed.
const CONTROL_PATTERN = new RegExp(
  "[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F" +
    "\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]"
);

const LONE_SURROGATE_PATTERN = new RegExp(
  "[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]"
);

function validateMetadata(input: unknown): PublicGiftMetadata {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new MetadataValidationError("malformed", "Metadata payload must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "v" && key !== "theme" && key !== "note") {
      throw new MetadataValidationError("malformed", `Unknown metadata field "${key}".`);
    }
  }
  if (record.v !== METADATA_VERSION) {
    throw new MetadataValidationError("malformed", "Metadata field v must be exactly 1.");
  }
  if (typeof record.theme !== "string" || !(GIFT_THEMES as readonly string[]).includes(record.theme)) {
    throw new MetadataValidationError("invalid_theme", "Theme must be sunrise, confetti or night-sky.");
  }
  if (typeof record.note !== "string") {
    throw new MetadataValidationError("malformed", "Note must be a string.");
  }
  const note = normalizeNote(record.note);
  return { v: 1, theme: record.theme as GiftTheme, note };
}

/**
 * NFC normalization plus surrounding-whitespace trim. Rejects empty notes,
 * oversized notes (counted in Unicode code points), lone surrogates,
 * control and format characters, and angle brackets so notes stay plain
 * text without HTML.
 */
function normalizeNote(note: string): string {
  const normalized = note.normalize("NFC").trim();
  if (normalized.length === 0) {
    throw new MetadataValidationError("empty_note", "Note must not be empty.");
  }
  if ([...normalized].length > MAX_NOTE_CHARS) {
    throw new MetadataValidationError(
      "note_too_long",
      `Note must be at most ${MAX_NOTE_CHARS} characters.`
    );
  }
  if (LONE_SURROGATE_PATTERN.test(normalized)) {
    throw new MetadataValidationError("malformed", "Note contains invalid Unicode.");
  }
  if (normalized.includes("<") || normalized.includes(">")) {
    throw new MetadataValidationError("unsafe_note", "Note must be plain text without markup.");
  }
  if (CONTROL_PATTERN.test(normalized.replace(/\n|\t/g, ""))) {
    throw new MetadataValidationError("unsafe_note", "Note contains disallowed characters.");
  }
  return normalized;
}
