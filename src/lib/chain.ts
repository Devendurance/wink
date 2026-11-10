import {
  createPublicClient,
  decodeEventLog,
  http,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import vaultArtifact from "../../abi/WinkGiftVault.json";

/**
 * Typed read helpers for WinkGiftVault. Reads only, no signers, no private
 * keys. Custody and claim/reclaim authorization stay inside the contract.
 * All helpers treat giftId 0 as a valid ID and never invent addresses: when
 * no vault address is configured they return a not-configured state.
 */

const VAULT_ABI = (vaultArtifact as { abi: Abi }).abi;

export const BOTCHAIN_TESTNET_ID = 968;
export const BOTCHAIN_MAINNET_ID = 677;

export type ChainName = "botchainTestnet" | "botchainMainnet";

export interface ChainConfig {
  name: ChainName;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  vaultAddress: Address | null;
}

function readAddress(value: string | undefined): Address | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? (trimmed as Address) : null;
}

export function getChainConfig(name: ChainName): ChainConfig {
  if (name === "botchainMainnet") {
    return {
      name,
      chainId: BOTCHAIN_MAINNET_ID,
      rpcUrl: process.env.BOTCHAIN_MAINNET_RPC ?? "https://rpc.botchain.ai",
      explorerUrl: "https://scan.botchain.ai",
      vaultAddress: readAddress(process.env.NEXT_PUBLIC_VAULT_ADDRESS_MAINNET),
    };
  }
  return {
    name,
    chainId: BOTCHAIN_TESTNET_ID,
    rpcUrl: process.env.BOTCHAIN_TESTNET_RPC ?? "https://rpc.bohr.life",
    explorerUrl: "https://scan.bohr.life",
    vaultAddress: readAddress(process.env.NEXT_PUBLIC_VAULT_ADDRESS_TESTNET),
  };
}

export class ChainReadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ChainReadError";
    this.code = code;
  }
}

export const GIFT_STATES = ["unset", "funded", "claimed", "reclaimed"] as const;
export type GiftStatus = (typeof GIFT_STATES)[number];

/** Contract enum index to lifecycle name. Throws on unknown indexes. */
export function mapGiftState(index: number | bigint): GiftStatus {
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0 || n >= GIFT_STATES.length) {
    throw new ChainReadError("unknown_state", `Unknown gift state index ${String(index)}.`);
  }
  return GIFT_STATES[n];
}

/**
 * Normalize a gift ID from bigint, number or string. giftId 0 is valid.
 * Rejects negatives, fractions, empty and non-numeric input explicitly
 * instead of relying on falsy checks.
 */
export function normalizeGiftId(id: bigint | number | string): bigint {
  if (typeof id === "bigint") {
    if (id < 0n) throw new ChainReadError("bad_gift_id", "Gift ID must not be negative.");
    return id;
  }
  if (typeof id === "number") {
    if (!Number.isInteger(id) || id < 0) {
      throw new ChainReadError("bad_gift_id", "Gift ID must be a non-negative integer.");
    }
    return BigInt(id);
  }
  const trimmed = id.trim();
  if (!/^(0|[1-9][0-9]*)$/.test(trimmed)) {
    throw new ChainReadError("bad_gift_id", "Gift ID must be a non-negative integer.");
  }
  return BigInt(trimmed);
}

export interface GiftView {
  giftId: bigint;
  sender: Address;
  recipient: Address;
  amount: bigint;
  expiresAt: bigint;
  metadataHash: Hex;
  state: GiftStatus;
}

export type GiftLifecycle =
  | "unset"
  | "claimable"
  | "expired-awaiting-reclaim"
  | "claimed"
  | "reclaimed";

/** Contract state plus wall-clock time mapped to a product lifecycle stage. */
export function deriveLifecycle(gift: GiftView, nowSeconds: bigint): GiftLifecycle {
  if (gift.state === "claimed") return "claimed";
  if (gift.state === "reclaimed") return "reclaimed";
  if (gift.state === "unset") return "unset";
  return nowSeconds >= gift.expiresAt ? "expired-awaiting-reclaim" : "claimable";
}

export type ContractReader = Pick<PublicClient, "readContract">;

function defaultReader(config: ChainConfig): ContractReader {
  return createPublicClient({ transport: http(config.rpcUrl) });
}

export type ReadGiftResult =
  | { configured: false; reason: string }
  | { configured: true; gift: GiftView };

export type ReadCountResult =
  | { configured: false; reason: string }
  | { configured: true; count: bigint };

function notConfigured(config: ChainConfig): { configured: false; reason: string } {
  return {
    configured: false,
    reason: `No vault address configured for ${config.name}. Set NEXT_PUBLIC_VAULT_ADDRESS_${config.name === "botchainMainnet" ? "MAINNET" : "TESTNET"}.`,
  };
}

/** Read a gift by ID. Works for giftId 0. Never throws for missing config. */
export async function readGift(
  chain: ChainName,
  giftId: bigint | number | string,
  reader?: ContractReader
): Promise<ReadGiftResult> {
  const config = getChainConfig(chain);
  if (!config.vaultAddress) return notConfigured(config);
  const id = normalizeGiftId(giftId);
  const client = reader ?? defaultReader(config);
  let raw: unknown;
  try {
    raw = (await client.readContract({
      address: config.vaultAddress,
      abi: VAULT_ABI,
      functionName: "getGift",
      args: [id],
    })) as unknown;
  } catch (err) {
    throw new ChainReadError("rpc_error", err instanceof Error ? err.message : "RPC read failed.");
  }
  return { configured: true, gift: toGiftView(id, raw) };
}

/** Read the total number of gifts created. */
export async function readGiftCount(
  chain: ChainName,
  reader?: ContractReader
): Promise<ReadCountResult> {
  const config = getChainConfig(chain);
  if (!config.vaultAddress) return notConfigured(config);
  const client = reader ?? defaultReader(config);
  try {
    const count = (await client.readContract({
      address: config.vaultAddress,
      abi: VAULT_ABI,
      functionName: "giftCount",
    })) as unknown;
    if (typeof count !== "bigint") {
      throw new ChainReadError("bad_response", "giftCount did not return a bigint.");
    }
    return { configured: true, count };
  } catch (err) {
    if (err instanceof ChainReadError) throw err;
    throw new ChainReadError("rpc_error", err instanceof Error ? err.message : "RPC read failed.");
  }
}

function field(record: Record<string, unknown>, name: string, index: number): unknown {
  const named = record[name];
  if (named !== undefined) return named;
  return (record as unknown as unknown[])[index];
}

/** Normalize a viem getGift struct (named or tuple shaped) into a GiftView. */
export function toGiftView(giftId: bigint, raw: unknown): GiftView {
  if (typeof raw !== "object" || raw === null) {
    throw new ChainReadError("bad_response", "getGift did not return a gift struct.");
  }
  const record = raw as Record<string, unknown>;
  const sender = field(record, "sender", 0);
  const recipient = field(record, "recipient", 1);
  const amount = field(record, "amount", 2);
  const expiresAt = field(record, "expiresAt", 3);
  const metadataHash = field(record, "metadataHash", 4);
  const state = field(record, "state", 5);
  if (typeof sender !== "string" || typeof recipient !== "string") {
    throw new ChainReadError("bad_response", "Gift sender or recipient is not an address.");
  }
  if (typeof amount !== "bigint" || typeof expiresAt !== "bigint") {
    throw new ChainReadError("bad_response", "Gift amount or expiry has the wrong type.");
  }
  if (typeof metadataHash !== "string") {
    throw new ChainReadError("bad_response", "Gift metadata hash has the wrong type.");
  }
  return {
    giftId,
    sender: sender as Address,
    recipient: recipient as Address,
    amount,
    expiresAt,
    metadataHash: metadataHash as Hex,
    state: mapGiftState(state as number | bigint),
  };
}

export type VaultEventName = "GiftCreated" | "GiftClaimed" | "GiftReclaimed";

export interface VaultEvent {
  name: VaultEventName;
  args: Record<string, unknown>;
}

/** Decode one log with the vault ABI. Returns null for unrelated logs. */
export function decodeVaultLog(log: { data: Hex; topics: Hex[] }): VaultEvent | null {
  let decoded: { eventName?: string; args?: unknown };
  try {
    decoded = decodeEventLog({
      abi: VAULT_ABI,
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });
  } catch {
    return null;
  }
  if (
    decoded.eventName !== "GiftCreated" &&
    decoded.eventName !== "GiftClaimed" &&
    decoded.eventName !== "GiftReclaimed"
  ) {
    return null;
  }
  const args =
    typeof decoded.args === "object" && decoded.args !== null
      ? { ...(decoded.args as Record<string, unknown>) }
      : {};
  return { name: decoded.eventName, args };
}

/** Decode every vault log in a list, skipping unrelated logs. */
export function decodeVaultLogs(logs: { data: Hex; topics: Hex[] }[]): VaultEvent[] {
  const events: VaultEvent[] = [];
  for (const log of logs) {
    const event = decodeVaultLog(log);
    if (event) events.push(event);
  }
  return events;
}

export interface VaultReceiptCheck {
  statusOk: boolean;
  vaultLogs: number;
  events: VaultEvent[];
  giftIds: bigint[];
}

interface ReceiptLike {
  status: string | null;
  logs: { address: string; data: Hex; topics: Hex[] }[];
}

/**
 * Validate a transaction receipt against the expected vault address:
 * success status plus at least one decodable vault event. Never throws
 * for malformed receipts, it reports them.
 */
export function validateVaultReceipt(receipt: ReceiptLike, vaultAddress: string): VaultReceiptCheck {
  const empty: VaultReceiptCheck = { statusOk: false, vaultLogs: 0, events: [], giftIds: [] };
  const expected = vaultAddress.toLowerCase();
  if (receipt.status !== "success") return empty;
  const vaultLogs = receipt.logs.filter((log) => log.address.toLowerCase() === expected);
  const events = decodeVaultLogs(vaultLogs);
  if (events.length === 0) return { ...empty, statusOk: true, vaultLogs: vaultLogs.length };
  const giftIds: bigint[] = [];
  for (const event of events) {
    if (typeof event.args.giftId === "bigint") giftIds.push(event.args.giftId);
  }
  return { statusOk: true, vaultLogs: vaultLogs.length, events, giftIds };
}
