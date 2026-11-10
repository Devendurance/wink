import { NextResponse } from "next/server";
import { BOTCHAIN_MAINNET_ID, BOTCHAIN_TESTNET_ID, getChainConfig } from "@/lib/chain";
import { parseNetwork, type DeploymentState } from "@/lib/deployment";
import { describeDeployments } from "@/lib/network";
import { clientIpFromHeaders, rateLimit } from "@/lib/rateLimit";

/**
 * Safe health and readiness info. Reports booleans, public chain IDs, public
 * contract addresses and public variable NAMES only. It never returns secret
 * values or connection strings.
 *
 * Add ?deep=1 to also ask each configured chain's RPC whether contract code
 * exists at the configured vault. A network is only "launchReady" when it is
 * fully configured AND code exists on chain. That check is rate limited.
 */

function summarize(state: DeploymentState) {
  return state.status === "ready"
    ? { configured: true, chainId: state.chainId, vaultAddress: state.vault, deployBlock: state.deployBlock.toString(), missing: [] as string[] }
    : { configured: false, chainId: state.chainId, vaultAddress: null, deployBlock: null, missing: state.missing };
}

async function codeExists(rpcUrl: string, address: string, expectedChainId: number): Promise<boolean | null> {
  const call = async (method: string, params: unknown[]) => {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(5000),
    });
    return ((await res.json()) as { result?: string }).result;
  };
  try {
    const id = await call("eth_chainId", []);
    if (typeof id !== "string" || Number(BigInt(id)) !== expectedChainId) return null;
    const code = await call("eth_getCode", [address, "latest"]);
    return typeof code === "string" ? code !== "0x" : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const env = {
    network: process.env.NEXT_PUBLIC_WINK_NETWORK,
    vaultTestnet: process.env.NEXT_PUBLIC_VAULT_ADDRESS_TESTNET,
    vaultMainnet: process.env.NEXT_PUBLIC_VAULT_ADDRESS_MAINNET,
    deployBlockTestnet: process.env.NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_TESTNET,
    deployBlockMainnet: process.env.NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_MAINNET,
  };
  const states = describeDeployments(env);
  const testnet = summarize(states.testnet);
  const mainnet = summarize(states.mainnet);
  const body: Record<string, unknown> = {
    status: "ok",
    service: "wink",
    time: new Date().toISOString(),
    activeNetwork: parseNetwork(env.network),
    metadataStore: process.env.DATABASE_URL ? "configured" : "not-configured",
    chains: {
      testnet: { ...testnet, chainId: BOTCHAIN_TESTNET_ID },
      mainnet: { ...mainnet, chainId: BOTCHAIN_MAINNET_ID },
    },
  };

  if (new URL(request.url).searchParams.get("deep") === "1") {
    const limit = await rateLimit("health:deep", clientIpFromHeaders(request.headers), 20, 60);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
    const check = async (key: "testnet" | "mainnet", cfg: typeof testnet) => {
      if (!cfg.configured || !cfg.vaultAddress) return { codeOnChain: null, launchReady: false };
      const exists = await codeExists(getChainConfig(key === "testnet" ? "botchainTestnet" : "botchainMainnet").rpcUrl, cfg.vaultAddress, cfg.chainId);
      return { codeOnChain: exists, launchReady: exists === true };
    };
    const [t, m] = await Promise.all([check("testnet", testnet), check("mainnet", mainnet)]);
    body.chains = { testnet: { ...testnet, ...t }, mainnet: { ...mainnet, ...m } };
  }
  return NextResponse.json(body);
}
