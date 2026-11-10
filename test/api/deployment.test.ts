import { describe, expect, it } from "vitest";
import { parseDeployBlock, parseNetwork, parseVaultAddress, resolveActive, resolveDeployment } from "../../src/lib/deployment";
import { buildActiveNetwork } from "../../src/lib/network";

const KNOWN = { address: "0x61CB150B69baBa224A75F88307eAf9ce8B992c8E", block: 29949363 };
const MAIN = "0x1234567890abcdef1234567890abcdef12345678";

describe("deployment resolution", () => {
  it("uses the recorded testnet deployment by default", () => {
    const s = resolveDeployment("testnet", {}, KNOWN);
    expect(s).toMatchObject({ status: "ready", chainId: 968, vault: KNOWN.address, deployBlock: 29949363n });
  });

  it("mainnet without an address is not configured and never borrows testnet data", () => {
    const s = resolveDeployment("mainnet", { vaultTestnet: KNOWN.address, deployBlockTestnet: "29949363" }, KNOWN);
    expect(s.status).toBe("not-configured");
    if (s.status === "not-configured") {
      expect(s.chainId).toBe(677);
      expect(s.missing.join(" ")).toContain("NEXT_PUBLIC_VAULT_ADDRESS_MAINNET");
    }
  });

  it("mainnet with an address but no deployment block is not configured", () => {
    const s = resolveDeployment("mainnet", { vaultMainnet: MAIN }, KNOWN);
    expect(s.status).toBe("not-configured");
    if (s.status === "not-configured") expect(s.missing.join(" ")).toContain("DEPLOY_BLOCK_MAINNET");
  });

  it("mainnet is ready only with both a valid address and block", () => {
    expect(resolveDeployment("mainnet", { vaultMainnet: MAIN, deployBlockMainnet: "30000000" }, KNOWN)).toMatchObject({
      status: "ready",
      chainId: 677,
      vault: MAIN,
      deployBlock: 30000000n,
    });
  });

  it.each(["0", "-5", "1.5", "abc", "", "0x10", "99999999999999999999"])("rejects deployment block %j", (v) => {
    expect(parseDeployBlock(v)).toBeNull();
  });

  it.each(["0x123", "", "0x0000000000000000000000000000000000000000", "1234567890abcdef1234567890abcdef12345678", "0xZZ34567890abcdef1234567890abcdef12345678"])(
    "rejects vault address %j",
    (v) => {
      expect(parseVaultAddress(v)).toBeNull();
    }
  );

  it("a testnet address override needs its own block", () => {
    const other = "0x2222222222222222222222222222222222222222";
    expect(resolveDeployment("testnet", { vaultTestnet: other }, KNOWN).status).toBe("not-configured");
    expect(resolveDeployment("testnet", { vaultTestnet: other, deployBlockTestnet: "100" }, KNOWN)).toMatchObject({ status: "ready", vault: other, deployBlock: 100n });
  });

  it("rejects an unknown network value instead of silently using testnet", () => {
    expect(parseNetwork("Mainnet ")).toBe("mainnet");
    expect(parseNetwork(undefined)).toBe("testnet");
    expect(parseNetwork("prod")).toBe("invalid");
    expect(resolveActive({ network: "prod" }, KNOWN).status).toBe("not-configured");
  });
});

describe("active network and writes", () => {
  it("testnet stays fully configured", () => {
    const a = buildActiveNetwork({});
    expect(a).toMatchObject({ configured: true, isTestnet: true, label: "BOT Chain Testnet" });
    expect(a.chain.id).toBe(968);
    expect(a.deployBlock).toBe(29949363n);
  });

  it("mainnet without configuration has no vault, so no write path exists", () => {
    const a = buildActiveNetwork({ network: "mainnet" });
    expect(a.chain.id).toBe(677);
    expect(a.configured).toBe(false);
    expect(a.vault).toBeNull();
    expect(a.deployBlock).toBeNull();
    expect(a.isTestnet).toBe(false);
  });

  it("mainnet never inherits the testnet vault even if only testnet vars are set", () => {
    const a = buildActiveNetwork({ network: "mainnet", vaultTestnet: "0x61CB150B69baBa224A75F88307eAf9ce8B992c8E", deployBlockTestnet: "1" });
    expect(a.vault).toBeNull();
  });

  it("configured mainnet gets its own block", () => {
    const a = buildActiveNetwork({ network: "mainnet", vaultMainnet: MAIN, deployBlockMainnet: "30000000" });
    expect(a).toMatchObject({ configured: true, vault: MAIN, deployBlock: 30000000n, isTestnet: false });
  });

  it("an invalid network value disables writes", () => {
    expect(buildActiveNetwork({ network: "mainet" }).vault).toBeNull();
  });
});
