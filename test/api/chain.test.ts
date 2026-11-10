import { afterEach, describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbi, parseAbiParameters } from "viem";
import type { Address, Hex } from "viem";
import {
  decodeVaultLog,
  decodeVaultLogs,
  deriveLifecycle,
  getChainConfig,
  mapGiftState,
  normalizeGiftId,
  readGift,
  readGiftCount,
  toGiftView,
  validateVaultReceipt,
  type ContractReader,
} from "../../src/lib/chain";

const EVENTS_ABI = parseAbi([
  "event GiftCreated(uint256 indexed giftId, address indexed sender, address indexed recipient, uint256 amount, uint64 expiresAt, bytes32 metadataHash)",
  "event GiftClaimed(uint256 indexed giftId, address indexed recipient, uint256 amount)",
  "event GiftReclaimed(uint256 indexed giftId, address indexed sender, uint256 amount)",
]);

const SENDER = "0x1111111111111111111111111111111111111111" as Address;
const RECIPIENT = "0x2222222222222222222222222222222222222222" as Address;
const VAULT = "0x3333333333333333333333333333333333333333" as Address;
const HASH = "0x1334270ae8bbe02661732287d9a3d7482e23b8bcc7ac7feb4058ff9a1b8e5c40" as Hex;

const ENV_KEYS = ["NEXT_PUBLIC_VAULT_ADDRESS_TESTNET", "NEXT_PUBLIC_VAULT_ADDRESS_MAINNET"] as const;

/** Build a realistic log without a node, using viem topic/data encoders. */
function makeLog(
  eventName: "GiftCreated" | "GiftClaimed",
  indexed: Record<string, unknown>,
  types: string,
  values: unknown[]
): { data: Hex; topics: Hex[] } {
  const topics = encodeEventTopics({ abi: EVENTS_ABI, eventName, args: indexed });
  const data = encodeAbiParameters(parseAbiParameters(types), values as never[]);
  return { data, topics: topics as Hex[] };
}
const savedEnv: Record<string, string | undefined> = {};

function setVaultEnv(): void {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    process.env[key] = VAULT;
  }
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function fakeReader(value: unknown): ContractReader {
  return { readContract: async () => value } as unknown as ContractReader;
}

describe("gift state mapping", () => {
  it("maps every known state index", () => {
    expect(mapGiftState(0)).toBe("unset");
    expect(mapGiftState(1)).toBe("funded");
    expect(mapGiftState(2)).toBe("claimed");
    expect(mapGiftState(3)).toBe("reclaimed");
  });

  it("rejects unknown state indexes", () => {
    expect(() => mapGiftState(9)).toThrowError(expect.objectContaining({ code: "unknown_state" }));
  });
});

describe("normalizeGiftId", () => {
  it("accepts giftId 0 in every supported shape", () => {
    expect(normalizeGiftId(0n)).toBe(0n);
    expect(normalizeGiftId(0)).toBe(0n);
    expect(normalizeGiftId("0")).toBe(0n);
    expect(normalizeGiftId("  7 ")).toBe(7n);
  });

  it("rejects negatives, fractions and non-numeric input", () => {
    for (const bad of [-1, 1.5, -1n, "", "abc", "0x1", "1.0"]) {
      expect(() => normalizeGiftId(bad as never), String(bad)).toThrowError(
        expect.objectContaining({ code: "bad_gift_id" })
      );
    }
  });
});

describe("deriveLifecycle", () => {
  const base = {
    giftId: 0n,
    sender: SENDER,
    recipient: RECIPIENT,
    amount: 100n,
    expiresAt: 2000n,
    metadataHash: HASH,
  };

  it("handles giftId 0 through funded, expired, claimed and reclaimed", () => {
    expect(deriveLifecycle({ ...base, state: "funded" }, 1000n)).toBe("claimable");
    expect(deriveLifecycle({ ...base, state: "funded" }, 2000n)).toBe("expired-awaiting-reclaim");
    expect(deriveLifecycle({ ...base, state: "claimed" }, 1000n)).toBe("claimed");
    expect(deriveLifecycle({ ...base, state: "reclaimed" }, 3000n)).toBe("reclaimed");
    expect(deriveLifecycle({ ...base, state: "unset" }, 1000n)).toBe("unset");
  });
});

describe("toGiftView", () => {
  it("reads named and tuple shaped structs", () => {
    const named = { sender: SENDER, recipient: RECIPIENT, amount: 5n, expiresAt: 9n, metadataHash: HASH, state: 1 };
    expect(toGiftView(0n, named).giftId).toBe(0n);
    expect(toGiftView(0n, named).state).toBe("funded");
    const tuple = [SENDER, RECIPIENT, 5n, 9n, HASH, 2];
    expect(toGiftView(3n, tuple).state).toBe("claimed");
  });

  it("rejects malformed contract responses", () => {
    expect(() => toGiftView(0n, null)).toThrowError(expect.objectContaining({ code: "bad_response" }));
    expect(() => toGiftView(0n, { sender: SENDER })).toThrowError(
      expect.objectContaining({ code: "bad_response" })
    );
  });
});

describe("vault event decoding", () => {
  it("round-trips GiftCreated with giftId 0", () => {
    const log = makeLog(
      "GiftCreated",
      { giftId: 0n, sender: SENDER, recipient: RECIPIENT },
      "uint256 amount, uint64 expiresAt, bytes32 metadataHash",
      [100n, 999n, HASH]
    );
    const decoded = decodeVaultLog(log);
    expect(decoded?.name).toBe("GiftCreated");
    expect(decoded?.args.giftId).toBe(0n);
  });

  it("skips unrelated logs", () => {
    expect(
      decodeVaultLog({ data: "0x1234" as Hex, topics: ["0xdead" as Hex] })
    ).toBeNull();
    expect(decodeVaultLogs([])).toEqual([]);
  });
});

describe("receipt validation", () => {
  function createdLog(): { address: string; data: Hex; topics: Hex[] } {
    const log = makeLog(
      "GiftClaimed",
      { giftId: 0n, recipient: RECIPIENT },
      "uint256 amount",
      [50n]
    );
    return { address: VAULT, ...log };
  }

  it("accepts successful receipts with vault events", () => {
    const check = validateVaultReceipt({ status: "success", logs: [createdLog()] }, VAULT);
    expect(check.statusOk).toBe(true);
    expect(check.vaultLogs).toBe(1);
    expect(check.events[0]?.name).toBe("GiftClaimed");
    expect(check.giftIds).toEqual([0n]);
  });

  it("rejects reverted receipts and foreign logs", () => {
    expect(validateVaultReceipt({ status: "reverted", logs: [createdLog()] }, VAULT).statusOk).toBe(false);
    const foreign = validateVaultReceipt({ status: "success", logs: [{ ...createdLog(), address: SENDER }] }, VAULT);
    expect(foreign.vaultLogs).toBe(0);
    expect(foreign.events).toEqual([]);
  });
});

describe("read helpers", () => {
  it("returns not-configured instead of inventing an address", async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const result = await readGift("botchainTestnet", 0);
    expect(result.configured).toBe(false);
    if (!result.configured) expect(result.reason).toContain("NEXT_PUBLIC_VAULT_ADDRESS_TESTNET");
  });

  it("reads giftId 0 through a mocked RPC", async () => {
    setVaultEnv();
    const reader = fakeReader({
      sender: SENDER,
      recipient: RECIPIENT,
      amount: 100n,
      expiresAt: 5000n,
      metadataHash: HASH,
      state: 1,
    });
    for (const id of [0, "0", 0n]) {
      const result = await readGift("botchainTestnet", id, reader);
      expect(result.configured).toBe(true);
      if (result.configured) {
        expect(result.gift.giftId).toBe(0n);
        expect(result.gift.state).toBe("funded");
      }
    }
    const count = await readGiftCount("botchainTestnet", fakeReader(42n));
    expect(count).toEqual({ configured: true, count: 42n });
  });

  it("maps RPC failures to typed errors without leaking keys", async () => {
    setVaultEnv();
    process.env.PRIVATE_KEY = "0xsecret-in-test-should-never-appear";
    const failing = { readContract: async () => { throw new Error("boom"); } } as unknown as ContractReader;
    await expect(readGift("botchainTestnet", 1, failing)).rejects.toMatchObject({ code: "rpc_error" });
    const config = getChainConfig("botchainTestnet");
    expect(JSON.stringify(config)).not.toContain("0xsecret-in-test-should-never-appear");
    delete process.env.PRIVATE_KEY;
  });
});
