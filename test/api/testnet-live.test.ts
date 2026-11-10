import { describe, expect, it } from "vitest";
import { createPublicClient, http } from "viem";
import {
  deriveLifecycle,
  readGift,
  readGiftCount,
  validateVaultReceipt,
} from "../../src/lib/chain";
import { createMetadataHash } from "../../src/lib/metadata";

process.env.NEXT_PUBLIC_VAULT_ADDRESS_TESTNET = "0x61CB150B69baBa224A75F88307eAf9ce8B992c8E";

const CREATE_TX = "0xe0a7c3a79230411c1c610c07b1e0cdcf3c714c7d8328d88ccfe9bc0dd0bd0d55";
const CLAIM_TX = "0x2d001b193ac887526e10c448c6748f6f3e3762eb44e4a66e9e3288d811097577";
const VAULT = "0x61CB150B69baBa224A75F88307eAf9ce8B992c8E";

const live = describe.skipIf(!process.env.WINK_LIVE_TESTNET);
live("live testnet reads (Bohr 968)", () => {
  it("reads gift 0 and the real count", async () => {
    const r0 = await readGift("botchainTestnet", 0);
    expect(r0.configured).toBe(true);
    if (!r0.configured) return;
    expect(r0.gift.sender.toLowerCase()).toBe("0x374a94c75bd463635cc6c96141b0ef31acd02ef3");
    expect(r0.gift.recipient.toLowerCase()).toBe("0xb81b993de338e8fbcd2af92ac5dceb7309f2da35");
    expect(r0.gift.amount).toBe(10000000000000000n);
    expect(r0.gift.state).toBe("claimed");
    expect(deriveLifecycle(r0.gift, BigInt(Math.floor(Date.now() / 1000)))).toBe("claimed");

    // On-chain hash matches the metadata helper output for the same payload.
    const local = createMetadataHash({ v: 1, theme: "sunrise", note: "slice three live gift" });
    expect(r0.gift.metadataHash.toLowerCase()).toBe(local.hash);

    const count = await readGiftCount("botchainTestnet");
    expect(count).toEqual({ configured: true, count: 2n });
  }, 60000);

  it("decodes and validates the real receipts", async () => {
    const client = createPublicClient({ transport: http("https://rpc.bohr.life") });
    const created = await client.getTransactionReceipt({ hash: CREATE_TX as `0x${string}` });
    const claimed = await client.getTransactionReceipt({ hash: CLAIM_TX as `0x${string}` });
    const v1 = validateVaultReceipt(created, VAULT);
    expect(v1.statusOk).toBe(true);
    expect(v1.events.map((e) => e.name)).toContain("GiftCreated");
    expect(v1.giftIds).toContain(0n);
    const v2 = validateVaultReceipt(claimed, VAULT);
    expect(v2.statusOk).toBe(true);
    expect(v2.events.map((e) => e.name)).toContain("GiftClaimed");
    // Wrong address matches nothing.
    const wrong = validateVaultReceipt(claimed, "0x0000000000000000000000000000000000000001");
    expect(wrong.vaultLogs).toBe(0);
  }, 60000);

  it("reports unknown gift IDs as typed errors", async () => {
    await expect(readGift("botchainTestnet", 999999)).rejects.toMatchObject({ name: "ChainReadError" });
  }, 60000);
});
