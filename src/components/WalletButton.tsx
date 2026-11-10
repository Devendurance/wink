"use client";

import { useState, useSyncExternalStore } from "react";
import { useBalance, useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { formatBot, shortAddress } from "@/lib/giftRules";
import { ACTIVE } from "@/lib/network";

const noopSubscribe = () => () => {};

/** True once on the client, false during server render. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** True when an injected wallet provider exists in this browser. */
export function useHasInjectedProvider(): boolean {
  const connectors = useConnectors();
  const hasWindowProvider = useSyncExternalStore(
    noopSubscribe,
    () => typeof (window as unknown as { ethereum?: unknown }).ethereum !== "undefined",
    () => false
  );
  return hasWindowProvider || connectors.some((c) => c.id !== "injected");
}

/** Deep links that reopen the current page inside a wallet app's browser. */
export function walletDeepLinks(href: string): { name: string; url: string }[] {
  const bare = href.replace(/^https?:\/\//, "");
  return [
    { name: "MetaMask", url: `https://link.metamask.io/dapp/${bare}` },
    { name: "Coinbase Wallet", url: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(href)}` },
    { name: "Trust Wallet", url: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(href)}` },
  ];
}

export function NoWalletHelp() {
  const [copied, setCopied] = useState(false);
  const href = typeof window === "undefined" ? "" : window.location.href;
  return (
    <div className="panel" role="status" style={{ padding: 20 }}>
      <p className="numeral" style={{ fontSize: 16 }}>No wallet found in this browser</p>
      <p className="muted" style={{ marginTop: 6 }}>
        Wink works with any EVM wallet. On a phone, open this exact page inside your wallet app so your gift link stays
        with you. On a computer, install a wallet extension such as MetaMask or Rabby and refresh.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {walletDeepLinks(href).map((w) => (
          <a key={w.name} className="btn btn-ghost" style={{ minHeight: 40, padding: "0 16px", fontSize: 14 }} href={w.url}>
            Open in {w.name}
          </a>
        ))}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ minHeight: 40, padding: "0 16px", fontSize: 14 }}
          onClick={() => {
            navigator.clipboard?.writeText(href).then(() => setCopied(true), () => {});
          }}
        >
          {copied ? "Link copied" : "Copy this page link"}
        </button>
      </div>
    </div>
  );
}

/** Connect panel used inside the nav menu and on gift/create screens. */
export function ConnectPanel({ onDone }: { onDone?: () => void }) {
  const connectors = useConnectors();
  const { mutate: connect, isPending, error } = useConnect();
  const hasProvider = useHasInjectedProvider();
  const isClient = useIsClient();
  if (!isClient) return <div className="muted">Loading wallets...</div>;
  if (!hasProvider) return <NoWalletHelp />;
  // Prefer discovered wallets. Fall back to the generic injected connector.
  const discovered = connectors.filter((c) => c.id !== "injected");
  const list = discovered.length > 0 ? discovered : connectors;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {list.map((c) => (
        <button
          key={c.uid}
          type="button"
          className="btn btn-white"
          disabled={isPending}
          onClick={() => connect({ connector: c }, { onSuccess: onDone })}
        >
          {c.name === "Injected" ? "Browser wallet" : c.name}
        </button>
      ))}
      {error ? (
        <p className="help help-error" role="alert">
          {/rejected|denied/i.test(error.message) ? "The connection request was closed. Try again when ready." : "Could not connect to that wallet."}
        </p>
      ) : null}
    </div>
  );
}

export function WalletButton() {
  const { address, isConnected, chainId } = useConnection();
  const { mutate: disconnect } = useDisconnect();
  const { mutate: switchChain, isPending: switching } = useSwitchChain();
  const isClient = useIsClient();
  const [open, setOpen] = useState(false);
  const { data: balance } = useBalance({ address, chainId: ACTIVE.chain.id, query: { enabled: !!address } });

  if (!isClient) return <span className="btn btn-ghost" style={{ minHeight: 44, opacity: 0.4 }} aria-hidden>Connect</span>;

  const wrong = isConnected && chainId !== ACTIVE.chain.id;
  return (
    <div style={{ position: "relative" }}>
      {isConnected && address ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ minHeight: 44, padding: "0 16px" }}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: wrong ? "var(--error)" : "var(--success)" }} />
          {shortAddress(address)}
        </button>
      ) : (
        <button type="button" className="btn btn-white" style={{ minHeight: 44 }} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          Connect wallet
        </button>
      )}
      {open ? (
        <div
          role="dialog"
          aria-label="Wallet"
          className="panel"
          style={{ position: "absolute", right: 0, top: 54, width: "min(340px, calc(100vw - 32px))", zIndex: 60, boxShadow: "0 40px 100px -20px rgba(0,0,0,0.8)" }}
        >
          {isConnected && address ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <p className="muted" style={{ fontSize: 12 }}>Connected account</p>
                <p style={{ wordBreak: "break-all", fontWeight: 500 }}>{address}</p>
              </div>
              <div>
                <p className="muted" style={{ fontSize: 12 }}>BOT balance on {ACTIVE.label}</p>
                <p className="numeral" style={{ fontSize: 20 }}>{balance ? `${formatBot(balance.value, 4)} BOT` : "..."}</p>
              </div>
              {wrong ? (
                <button type="button" className="btn btn-ember" disabled={switching} onClick={() => switchChain({ chainId: ACTIVE.chain.id })}>
                  {switching ? "Check your wallet..." : `Switch to ${ACTIVE.label}`}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <ConnectPanel onDone={() => setOpen(false)} />
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Strip shown on any page when the wallet sits on the wrong network. */
export function WrongChainBanner() {
  const { isConnected, chainId } = useConnection();
  const { mutate: switchChain, isPending, error } = useSwitchChain();
  const isClient = useIsClient();
  if (!isClient || !isConnected || chainId === ACTIVE.chain.id) return null;
  return (
    <div role="alert" style={{ background: "#2a1218", borderBottom: "1px solid rgba(255,107,139,0.4)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 14 }}>
          Your wallet is on the wrong network. Wink runs on <strong>{ACTIVE.label}</strong> (chain {ACTIVE.chain.id}).
          {error ? " Your wallet declined the switch. Switch manually in the wallet." : ""}
        </p>
        <button type="button" className="btn btn-ember" style={{ minHeight: 40 }} disabled={isPending} onClick={() => switchChain({ chainId: ACTIVE.chain.id })}>
          {isPending ? "Check your wallet..." : "Switch network"}
        </button>
      </div>
    </div>
  );
}
