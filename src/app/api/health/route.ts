import { NextResponse } from "next/server";
import { BOTCHAIN_MAINNET_ID, BOTCHAIN_TESTNET_ID, getChainConfig } from "@/lib/chain";

/**
 * Safe health info. Reports booleans and public chain IDs only,
 * never secret values or connection strings.
 */
export async function GET(): Promise<NextResponse> {
  const testnet = getChainConfig("botchainTestnet");
  const mainnet = getChainConfig("botchainMainnet");
  return NextResponse.json({
    status: "ok",
    service: "wink",
    time: new Date().toISOString(),
    metadataStore: process.env.DATABASE_URL ? "configured" : "not-configured",
    chains: {
      testnet: {
        chainId: BOTCHAIN_TESTNET_ID,
        vaultConfigured: testnet.vaultAddress !== null,
        vaultAddress: testnet.vaultAddress,
      },
      mainnet: {
        chainId: BOTCHAIN_MAINNET_ID,
        vaultConfigured: mainnet.vaultAddress !== null,
        vaultAddress: mainnet.vaultAddress,
      },
    },
  });
}
