import { describe, expect, it } from "vitest";
import { keccak256, toBytes } from "viem";
import {
  canonicalizeMetadata,
  createMetadataHash,
  hashCanonicalMetadata,
  isMetadataHash,
  MAX_NOTE_CHARS,
  MetadataValidationError,
} from "@/lib/metadata";

const VECTOR_CANONICAL = '{"v":1,"theme":"sunrise","note":"hello wink"}';
const VECTOR_HASH = "0x1334270ae8bbe02661732287d9a3d7482e23b8bcc7ac7feb4058ff9a1b8e5c40";

describe("metadata canonical form", () => {
  it("matches the known vector exactly", () => {
    const { canonical, metadata, hash } = createMetadataHash({
      v: 1,
      theme: "sunrise",
      note: "hello wink",
    });
    expect(canonical).toBe(VECTOR_CANONICAL);
    expect(metadata).toEqual({ v: 1, theme: "sunrise", note: "hello wink" });
    expect(hash).toBe(VECTOR_HASH);
  });

  it("agrees with an independent keccak implementation", () => {
    const { canonical } = canonicalizeMetadata({ v: 1, theme: "night-sky", note: "stars" });
    expect(hashCanonicalMetadata(canonical)).toBe(keccak256(toBytes(canonical)));
  });

  it("is deterministic regardless of input key order", () => {
    const a = createMetadataHash({ v: 1, theme: "confetti", note: "party" });
    const b = createMetadataHash({ note: "party", v: 1, theme: "confetti" });
    expect(a.hash).toBe(b.hash);
    expect(a.canonical).toBe(b.canonical);
  });

  it("normalizes unicode so composed and decomposed notes share a hash", () => {
    const composed = createMetadataHash({ v: 1, theme: "confetti", note: "caf\u00e9" });
    const decomposed = createMetadataHash({ v: 1, theme: "confetti", note: "café" });
    expect(composed.hash).toBe(decomposed.hash);
    expect(composed.hash).toBe("0x1bf5a53bcbc85b63326e915504ea35695bfdad80a1d5ea58144c00bfeb41ad03");
  });

  it("trims surrounding whitespace before hashing", () => {
    const a = createMetadataHash({ v: 1, theme: "sunrise", note: "  hello  " });
    const b = createMetadataHash({ v: 1, theme: "sunrise", note: "hello" });
    expect(a.hash).toBe(b.hash);
  });
});

describe("metadata validation", () => {
  it("rejects invalid themes", () => {
    expect(() => createMetadataHash({ v: 1, theme: "volcano", note: "hi" })).toThrowError(
      expect.objectContaining({ code: "invalid_theme" })
    );
  });

  it("rejects malformed payloads", () => {
    const bad = [null, [], "note", 42, {}, { v: 2, theme: "sunrise", note: "hi" }, { v: 1, theme: "sunrise" }];
    for (const payload of bad) {
      expect(() => createMetadataHash(payload), JSON.stringify(payload)).toThrowError(
        MetadataValidationError
      );
    }
  });

  it("rejects unknown fields", () => {
    expect(() => createMetadataHash({ v: 1, theme: "sunrise", note: "hi", extra: 1 })).toThrowError(
      expect.objectContaining({ code: "malformed" })
    );
  });

  it("rejects empty and oversized notes", () => {
    expect(() => createMetadataHash({ v: 1, theme: "sunrise", note: "   " })).toThrowError(
      expect.objectContaining({ code: "empty_note" })
    );
    expect(() =>
      createMetadataHash({ v: 1, theme: "sunrise", note: "a".repeat(MAX_NOTE_CHARS + 1) })
    ).toThrowError(expect.objectContaining({ code: "note_too_long" }));
  });

  it("counts length in unicode characters, not utf-16 units", () => {
    const note = "😀".repeat(MAX_NOTE_CHARS);
    expect(createMetadataHash({ v: 1, theme: "sunrise", note }).metadata.note).toBe(note);
    expect(() =>
      createMetadataHash({ v: 1, theme: "sunrise", note: "😀".repeat(MAX_NOTE_CHARS + 1) })
    ).toThrowError(expect.objectContaining({ code: "note_too_long" }));
  });

  it("rejects markup and control characters", () => {
    expect(() =>
      createMetadataHash({ v: 1, theme: "sunrise", note: "hello <b>world</b>" })
    ).toThrowError(expect.objectContaining({ code: "unsafe_note" }));
    expect(() =>
      createMetadataHash({ v: 1, theme: "sunrise", note: "hi\u200Bthere" })
    ).toThrowError(expect.objectContaining({ code: "unsafe_note" }));
    expect(() =>
      createMetadataHash({ v: 1, theme: "sunrise", note: "a\u0000b" })
    ).toThrowError(expect.objectContaining({ code: "unsafe_note" }));
  });

  it("allows newlines and tabs", () => {
    const { metadata } = createMetadataHash({ v: 1, theme: "sunrise", note: "line one\nline two\tdone" });
    expect(metadata.note).toBe("line one\nline two\tdone");
  });
});

describe("isMetadataHash", () => {
  it("accepts strict bytes32 hex and rejects the rest", () => {
    expect(isMetadataHash(VECTOR_HASH)).toBe(true);
    expect(isMetadataHash("0x123")).toBe(false);
    expect(isMetadataHash("1334")).toBe(false);
    expect(isMetadataHash(42)).toBe(false);
    expect(isMetadataHash(null)).toBe(false);
  });
});
