"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useConnection, usePublicClient } from "wagmi";
import { scanSentGifts } from "@/lib/giftClient";
import { formatBot, shortAddress } from "@/lib/giftRules";
import { ACTIVE, TESTNET_VAULT_DEPLOY_BLOCK, txUrl } from "@/lib/network";
import { ConnectPanel } from "./WalletButton";

/** Read-only list built from real GiftCreated events of the configured vault. */
export function SentGifts() {
  const { address, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: ACTIVE.chain.id });
  const query = useQuery({
    queryKey: ["sent", ACTIVE.chain.id, address],
    enabled: !!address && !!publicClient && !!ACTIVE.vault,
    retry: 1,
    queryFn: () => scanSentGifts(publicClient!, ACTIVE.vault!, address!, TESTNET_VAULT_DEPLOY_BLOCK),
  });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px clamp(16px, 3vw, 40px) 96px" }}>
      <h1 className="display-2">Gifts you sent</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        Built from the vault&apos;s on-chain gift events. It only lists gifts sent from the connected wallet.
      </p>
      {!ACTIVE.vault ? (
        <div className="panel" style={{ marginTop: 32 }}>The Wink vault is not deployed on {ACTIVE.label} yet.</div>
      ) : !isConnected ? (
        <div className="panel" style={{ marginTop: 32, display: "grid", gap: 12 }}>
          <p className="heading-3">Connect your wallet</p>
          <p className="muted">We use your address to find gifts you funded.</p>
          <ConnectPanel />
        </div>
      ) : query.isPending ? (
        <div className="panel breathe" style={{ marginTop: 32 }} role="status">Scanning the vault for your gifts...</div>
      ) : query.isError ? (
        <div className="panel" style={{ marginTop: 32 }} role="alert">
          <p>The network did not answer, so we could not load your gifts.</p>
          <button type="button" className="btn btn-ember" style={{ marginTop: 12 }} onClick={() => void query.refetch()}>Try again</button>
        </div>
      ) : (
        <>
          {query.data.gifts.length === 0 ? (
            <div className="panel" style={{ marginTop: 32, display: "grid", gap: 12, justifyItems: "start" }}>
              <p className="heading-3">No gifts from this wallet yet</p>
              <Link href="/create" className="btn btn-ember">Create your first gift</Link>
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, marginTop: 32, display: "grid", gap: 12 }}>
              {query.data.gifts.map((g) => (
                <li key={g.giftId.toString()} className="panel" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", padding: 20 }}>
                  <div>
                    <p className="numeral" style={{ fontSize: 20 }}>{formatBot(g.amount, 6)} BOT</p>
                    <p className="muted" style={{ fontSize: 14 }}>Gift {g.giftId.toString()} for {shortAddress(g.recipient)}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/g/${g.giftId.toString()}`} className="btn btn-white" style={{ minHeight: 40 }}>Open gift page</Link>
                    <a href={txUrl(g.txHash)} className="btn btn-ghost" style={{ minHeight: 40 }} target="_blank" rel="noreferrer">Transaction</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="help" style={{ marginTop: 16 }}>
            Searched blocks {query.data.fromBlock.toString()} to {query.data.toBlock.toString()} on {ACTIVE.label}, from the vault&apos;s deployment onward.
            Open a gift page to see whether it was claimed, expired or reclaimed.
          </p>
        </>
      )}
    </div>
  );
}
