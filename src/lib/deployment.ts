/**
 * Pure, strict resolution of the active network's vault deployment.
 * No imports from the app and no process.env access here, so the same logic is
 * testable and Next.js can inline NEXT_PUBLIC_* values at the call site.
 *
 * Rules:
 * - Testnet and mainnet data are never substituted for each other.
 * - A vault is only "ready" when both its address and its deployment block are
 *   valid. Anything else is an explicit not-configured state with reasons.
 */

export type NetworkKey = "testnet" | "mainnet";

export interface RawDeploymentEnv {
  network?: string;
  vaultTestnet?: string;
  vaultMainnet?: string;
  deployBlockTestnet?: string;
  deployBlockMainnet?: string;
}

export interface KnownTestnetDeployment {
  address: string;
  block: number;
}

export type DeploymentState =
  | { status: "ready"; network: NetworkKey; chainId: number; vault: `0x${string}`; deployBlock: bigint }
  | { status: "not-configured"; network: NetworkKey | "invalid"; chainId: number; missing: string[] };

export const CHAIN_IDS: Record<NetworkKey, number> = { testnet: 968, mainnet: 677 };

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ZERO = /^0x0{40}$/;

export function parseVaultAddress(value: string | undefined): `0x${string}` | null {
  if (!value) return null;
  const v = value.trim();
  return ADDRESS.test(v) && !ZERO.test(v) ? (v as `0x${string}`) : null;
}

/** A deployment block is a positive base-10 integer within JS safe range. */
export function parseDeployBlock(value: string | number | undefined): bigint | null {
  if (value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!/^[1-9][0-9]{0,15}$/.test(text)) return null;
  const n = BigInt(text);
  return n <= BigInt(Number.MAX_SAFE_INTEGER) ? n : null;
}

/** Which network the site is running on. Empty means testnet. Unknown values are rejected. */
export function parseNetwork(value: string | undefined): NetworkKey | "invalid" {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "" || v === "testnet") return "testnet";
  if (v === "mainnet") return "mainnet";
  return "invalid";
}

export function resolveDeployment(
  network: NetworkKey,
  env: RawDeploymentEnv,
  knownTestnet?: KnownTestnetDeployment
): DeploymentState {
  const chainId = CHAIN_IDS[network];
  const missing: string[] = [];

  if (network === "mainnet") {
    // Mainnet comes only from explicit environment values. No JSON fallback exists.
    const vault = parseVaultAddress(env.vaultMainnet);
    const block = parseDeployBlock(env.deployBlockMainnet);
    if (!vault) missing.push("NEXT_PUBLIC_VAULT_ADDRESS_MAINNET (valid non-zero 0x address)");
    if (block === null) missing.push("NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_MAINNET (positive integer block number)");
    if (vault && block !== null) return { status: "ready", network, chainId, vault, deployBlock: block };
    return { status: "not-configured", network, chainId, missing };
  }

  const envVault = parseVaultAddress(env.vaultTestnet);
  const vault = envVault ?? parseVaultAddress(knownTestnet?.address);
  if (!vault) missing.push("NEXT_PUBLIC_VAULT_ADDRESS_TESTNET (valid non-zero 0x address)");
  let block = parseDeployBlock(env.deployBlockTestnet);
  if (block === null && vault && knownTestnet && vault.toLowerCase() === knownTestnet.address.toLowerCase()) {
    // The recorded block only belongs to the recorded address.
    block = parseDeployBlock(knownTestnet.block);
  }
  if (block === null) missing.push("NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_TESTNET (positive integer block number)");
  if (vault && block !== null) return { status: "ready", network, chainId, vault, deployBlock: block };
  return { status: "not-configured", network, chainId, missing };
}

/** Resolve whatever NEXT_PUBLIC_WINK_NETWORK selects, treating an invalid value as not configured. */
export function resolveActive(env: RawDeploymentEnv, knownTestnet?: KnownTestnetDeployment): DeploymentState {
  const network = parseNetwork(env.network);
  if (network === "invalid") {
    return {
      status: "not-configured",
      network: "invalid",
      chainId: CHAIN_IDS.testnet,
      missing: [`NEXT_PUBLIC_WINK_NETWORK must be "testnet" or "mainnet" (got "${String(env.network).slice(0, 24)}")`],
    };
  }
  return resolveDeployment(network, env, knownTestnet);
}
