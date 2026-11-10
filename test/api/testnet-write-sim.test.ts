import { createPublicClient, http, keccak256, toBytes, type Abi, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { toGiftView } from "@/lib/chain";
import { MIN_HOURS, computeExpiry, mapTxError } from "@/lib/giftRules";
import { ACTIVE, VAULT_ABI } from "@/lib/network";

/**
 * Live, read-only simulations of the write path against the real testnet
 * vault. simulateContract is an eth_call with a from address: no signer, no
 * transaction, no state change. Skipped unless WINK_LIVE_TESTNET=1.
 */
const live = process.env.WINK_LIVE_TESTNET === "1" ? describe : describe.skip;

live("testnet write-path simulation", { timeout: 60_000 }, () => {
  const client = createPublicClient({ chain: ACTIVE.chain, transport: http(ACTIVE.chain.rpcUrls.default.http[0]) });
  const vault = ACTIVE.vault as Address;

  const read = async (id: bigint) =>
    toGiftView(id, await client.readContract({ address: vault, abi: VAULT_ABI as Abi, functionName: "getGift", args: [id] }));
  const sim = (account: Address, functionName: string, args: unknown[], value?: bigint) =>
    client.simulateContract({ account, address: vault, abi: VAULT_ABI as Abi, functionName, args, value } as never);
  const kindOf = async (p: Promise<unknown>) => {
    try {
      await p;
      return "ok";
    } catch (err) {
      return mapTxError(err).kind;
    }
  };

  it("simulates createGift at the UI minimum expiry against live block time", async () => {
    const g1 = await read(1n);
    const block = await client.getBlock({ blockTag: "latest" });
    const expiresAt = computeExpiry(block.timestamp, MIN_HOURS);
    const hash = keccak256(toBytes("sim"));
    const result = await kindOf(sim(g1.sender, "createGift", [g1.recipient, expiresAt, hash], 10n ** 15n));
    expect(result).toBe("ok");
  });

  it("maps real contract reverts to friendly kinds", async () => {
    const g0 = await read(0n);
    const g1 = await read(1n);
    expect(g0.state).toBe("claimed");
    expect(await kindOf(sim(g0.recipient, "claim", [0n]))).toBe("already-claimed");
    expect(await kindOf(sim(g1.recipient, "claim", [1n]))).toBe("expired");
    expect(await kindOf(sim("0x4444444444444444444444444444444444444444", "reclaim", [1n]))).toBe("not-sender");
    expect(await kindOf(sim(g1.sender, "createGift", [g1.sender, 9_999_999_999n, keccak256(toBytes("x"))], 1n))).toBe("revert");
  });

  it("simulates reclaim for the sender of the expired gift 1", async () => {
    const g1 = await read(1n);
    if (g1.state !== "funded") return;
    expect(await kindOf(sim(g1.sender, "reclaim", [1n]))).toBe("ok");
  });
});
