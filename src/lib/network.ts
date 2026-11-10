import { defineChain, type Abi, type Address } from "viem";
import deployment from "../../deployments/botchainTestnet.json";
import vaultArtifact from "../../abi/WinkGiftVault.json";
import { BOTCHAIN_MAINNET_ID, BOTCHAIN_TESTNET_ID, getChainConfig } from "./chain";

/**
 * Frontend network definitions. The testnet vault is the real Slice 3
 * deployment. No mainnet vault address exists yet, so mainnet is defined as a
 * chain but is never treated as ready to create gifts.
 */

export const VAULT_ABI = (vaultArtifact as { abi: Abi }).abi;

function readAddress(value: string | undefined): Address | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? (trimmed as Address) : null;
}

const testnetCfg = getChainConfig("botchainTestnet");
const mainnetCfg = getChainConfig("botchainMainnet");

export const TESTNET_VAULT: Address | null =
  readAddress(process.env.NEXT_PUBLIC_VAULT_ADDRESS_TESTNET) ?? readAddress(deployment.address);
export const MAINNET_VAULT: Address | null = readAddress(process.env.NEXT_PUBLIC_VAULT_ADDRESS_MAINNET);

/** First block of the real testnet vault, the lower bound for event scans. */
export const TESTNET_VAULT_DEPLOY_BLOCK = BigInt(deployment.block);

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
  vault: Address | null;
  isTestnet: boolean;
  label: string;
  explorer: string;
}

/** Testnet is the only environment this slice targets. */
export const ACTIVE: ActiveNetwork =
  process.env.NEXT_PUBLIC_WINK_NETWORK === "mainnet"
    ? {
        chain: botMainnet,
        vault: MAINNET_VAULT,
        isTestnet: false,
        label: "BOT Chain",
        explorer: mainnetCfg.explorerUrl,
      }
    : {
        chain: botTestnet,
        vault: TESTNET_VAULT,
        isTestnet: true,
        label: "BOT Chain Testnet",
        explorer: testnetCfg.explorerUrl,
      };

export const txUrl = (hash: string): string => `${ACTIVE.explorer}/tx/${hash}`;
export const addressUrl = (address: string): string => `${ACTIVE.explorer}/address/${address}`;
