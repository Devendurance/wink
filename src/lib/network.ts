import { defineChain, type Abi, type Address } from "viem";
import deployment from "../../deployments/botchainTestnet.json";
import vaultArtifact from "../../abi/WinkGiftVault.json";
import { BOTCHAIN_MAINNET_ID, BOTCHAIN_TESTNET_ID, getChainConfig } from "./chain";
import { parseNetwork, resolveActive, resolveDeployment, type RawDeploymentEnv } from "./deployment";

/**
 * Frontend network definitions. The active network decides the chain, the vault
 * address and the deployment block together. If any of them is missing the
 * environment is "not configured": the vault is null and every write is
 * disabled. Testnet data is never used while running in mainnet mode.
 */

export const VAULT_ABI = (vaultArtifact as { abi: Abi }).abi;

const testnetCfg = getChainConfig("botchainTestnet");
const mainnetCfg = getChainConfig("botchainMainnet");

export const botTestnet = defineChain({
  id: BOTCHAIN_TESTNET_ID,
  name: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [testnetCfg.rpcUrl] } },
  blockExplorers: { default: { name: "Bohr Scan", url: testnetCfg.explorerUrl } },
  testnet: true,
});

export const botMainnet = defineChain({
  id: BOTCHAIN_MAINNET_ID,
  name: "BOT Chain",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [mainnetCfg.rpcUrl] } },
  blockExplorers: { default: { name: "BOT Scan", url: mainnetCfg.explorerUrl } },
});

export interface ActiveNetwork {
  chain: typeof botTestnet | typeof botMainnet;
  /** Null unless the vault address AND deployment block are valid for this network. */
  vault: Address | null;
  deployBlock: bigint | null;
  configured: boolean;
  /** Human readable reasons the network is not configured. Public variable names only. */
  missing: string[];
  isTestnet: boolean;
  label: string;
  explorer: string;
}

/** Build the active network from raw env values. Exported so tests can exercise every case. */
export function buildActiveNetwork(env: RawDeploymentEnv): ActiveNetwork {
  const key = parseNetwork(env.network);
  const state = resolveActive(env, { address: deployment.address, block: deployment.block });
  const isMainnet = key === "mainnet";
  const chain = isMainnet ? botMainnet : botTestnet;
  const base = {
    chain,
    isTestnet: !isMainnet,
    label: isMainnet ? "BOT Chain" : "BOT Chain Testnet",
    explorer: isMainnet ? mainnetCfg.explorerUrl : testnetCfg.explorerUrl,
  };
  if (state.status === "ready") {
    return { ...base, vault: state.vault, deployBlock: state.deployBlock, configured: true, missing: [] };
  }
  return { ...base, vault: null, deployBlock: null, configured: false, missing: state.missing };
}

/**
 * NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them
 * into the browser bundle.
 */
export const ACTIVE: ActiveNetwork = buildActiveNetwork({
  network: process.env.NEXT_PUBLIC_WINK_NETWORK,
  vaultTestnet: process.env.NEXT_PUBLIC_VAULT_ADDRESS_TESTNET,
  vaultMainnet: process.env.NEXT_PUBLIC_VAULT_ADDRESS_MAINNET,
  deployBlockTestnet: process.env.NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_TESTNET,
  deployBlockMainnet: process.env.NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_MAINNET,
});

/** Readiness of both networks, for health reporting. Never substitutes data between them. */
export function describeDeployments(env: RawDeploymentEnv) {
  const known = { address: deployment.address, block: deployment.block };
  return {
    testnet: resolveDeployment("testnet", env, known),
    mainnet: resolveDeployment("mainnet", env, known),
  };
}

export const txUrl = (hash: string): string => `${ACTIVE.explorer}/tx/${hash}`;
export const addressUrl = (address: string): string => `${ACTIVE.explorer}/address/${address}`;
