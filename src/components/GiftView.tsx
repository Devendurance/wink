"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBalance, useConnection, usePublicClient, useSwitchChain } from "wagmi";
import { ChainReadError, deriveLifecycle, normalizeGiftId, type GiftLifecycle, type GiftView as Gift } from "@/lib/chain";
import { fetchGiftMetadata, findProofTx, readGiftSnapshot } from "@/lib/giftClient";
import { confirmActionReceipt, formatBot, resolveGiftAction, sameAddress, shortAddress, type GiftAction } from "@/lib/giftRules";
import { ACTIVE, addressUrl, txUrl } from "@/lib/network";
import { useGasEstimate, useVaultTx } from "@/lib/useVaultTx";
import { ConnectPanel } from "./WalletButton";
import { GiftReveal } from "./GiftReveal";
import { TxStatus } from "./TxStatus";

const LIFECYCLE_COPY: Record<GiftLifecycle, { label: string; tone: string }> = {
  claimable: { label: "Funded and ready to claim", tone: "var(--lime)" },
  "expired-awaiting-reclaim": { label: "Expired, waiting for the sender to reclaim", tone: "var(--orange)" },
  claimed: { label: "Claimed", tone: "var(--cyan)" },
  reclaimed: { label: "Reclaimed by the sender", tone: "var(--n400)" },
  unset: { label: "Not funded", tone: "var(--n400)" },
};

function useNowMs(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function formatRemaining(seconds: bigint): string {
  let s = Number(seconds);
  if (s <= 0) return "now";
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}

function AddressRow({ label, address, you }: { label: string; address: string; you: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "1px solid var(--hairline)" }}>
      <span className="muted">{label}</span>
      <a href={addressUrl(address)} target="_blank" rel="noreferrer" title={address} style={{ fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3 }}>
        {shortAddress(address)}
        {you ? " (you)" : ""}
      </a>
    </div>
  );
}

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="panel" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }} role="status">
      <h1 className="heading-3">{title}</h1>
      <p className="muted" style={{ marginTop: 8 }}>{body}</p>
      {action ? <div style={{ marginTop: 20 }}>{action}</div> : null}
    </div>
  );
}

export function GiftPage({ giftId }: { giftId: string }) {
  let parsedId: bigint | null = null;
  try {
    parsedId = normalizeGiftId(giftId);
  } catch {
    parsedId = null;
  }
  if (parsedId === null) {
    return (
      <Shell>
        <Notice title="That is not a gift link" body="Gift links look like /g/0, /g/1 and so on. Check the link you were sent." action={<Link className="btn btn-ember" href="/">Back to Wink</Link>} />
      </Shell>
    );
  }
  if (!ACTIVE.vault) {
    return (
      <Shell>
        <Notice title="Gifts are not live here yet" body={`The Wink vault has not been deployed on ${ACTIVE.label}.`} />
      </Shell>
    );
  }
  return <GiftLoader id={parsedId} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1360, margin: "0 auto", padding: "40px clamp(16px, 3vw, 40px) 96px" }}>{children}</div>;
}

function GiftLoader({ id }: { id: bigint }) {
  const vault = ACTIVE.vault!;
  const publicClient = usePublicClient({ chainId: ACTIVE.chain.id });
  const queryClient = useQueryClient();
  const nowMs = useNowMs();

  const giftQuery = useQuery({
    queryKey: ["gift", ACTIVE.chain.id, id.toString()],
    enabled: !!publicClient,
    retry: (count, err) => !(err instanceof ChainReadError && err.code === "unknown_gift") && count < 2,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
    queryFn: async () => ({ ...(await readGiftSnapshot(publicClient!, vault, id)), fetchedAtMs: Date.now() }),
  });
  const gift = giftQuery.data?.gift;
  const snapForExpiry = giftQuery.data;
  // The countdown is extrapolated from the last block time plus elapsed browser
  // time. It is display only. Anything executable uses the chain timestamp alone.
  const extrapolatedNow = snapForExpiry
    ? snapForExpiry.chainNow + BigInt(Math.max(0, Math.floor((nowMs - snapForExpiry.fetchedAtMs) / 1000)))
    : 0n;
  const confirmingExpiry =
    !!snapForExpiry &&
    !!gift &&
    deriveLifecycle(gift, extrapolatedNow) === "expired-awaiting-reclaim" &&
    deriveLifecycle(gift, snapForExpiry.chainNow) === "claimable";
  const { refetch: refetchGift } = giftQuery;
  useEffect(() => {
    if (confirmingExpiry) void refetchGift();
  }, [confirmingExpiry, refetchGift]);

  const metaQuery = useQuery({
    queryKey: ["gift-meta", gift?.metadataHash],
    enabled: !!gift,
    retry: 1,
    queryFn: () => fetchGiftMetadata(gift!.metadataHash),
  });

  // Historical proof links are optional. A failure here never affects state or actions.
  const proofQuery = useQuery({
    queryKey: ["gift-proof", ACTIVE.chain.id, id.toString(), gift?.state],
    enabled: !!gift && !!publicClient && ACTIVE.deployBlock !== null,
    retry: 0,
    staleTime: 60_000,
    queryFn: async () => {
      const from = ACTIVE.deployBlock!;
      const opts = { chainId: ACTIVE.chain.id };
      const actionEvent = gift!.state === "claimed" ? "GiftClaimed" : gift!.state === "reclaimed" ? "GiftReclaimed" : null;
      const [created, action] = await Promise.allSettled([
        findProofTx(publicClient!, vault, id, "GiftCreated", from, opts),
        actionEvent ? findProofTx(publicClient!, vault, id, actionEvent, from, opts) : Promise.resolve(null),
      ]);
      return {
        created: created.status === "fulfilled" ? created.value : null,
        action: action.status === "fulfilled" ? action.value : null,
        failed: created.status === "rejected" || action.status === "rejected",
      };
    },
  });

  if (giftQuery.isPending) {
    return (
      <Shell>
        <div className="panel" aria-busy="true" role="status" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <p className="heading-3 breathe">Fetching gift {id.toString()} from the chain...</p>
        </div>
      </Shell>
    );
  }
  if (giftQuery.isError || !gift || !giftQuery.data) {
    const err = giftQuery.error;
    if (err instanceof ChainReadError && err.code === "unknown_gift") {
      return (
        <Shell>
          <Notice title="No gift found" body={`There is no gift number ${id.toString()} in the Wink vault on ${ACTIVE.label}. Double check the link.`} action={<Link className="btn btn-ember" href="/create">Create a gift</Link>} />
        </Shell>
      );
    }
    return (
      <Shell>
        <Notice
          title="Could not reach the network"
          body="The BOT Chain RPC did not answer, so we cannot confirm this gift right now. Nothing is wrong with the gift. Try again in a moment."
          action={<button type="button" className="btn btn-ember" onClick={() => void giftQuery.refetch()}>Try again</button>}
        />
      </Shell>
    );
  }

  const snap = giftQuery.data;
  const nowSeconds = extrapolatedNow;
  const lifecycle = deriveLifecycle(gift, nowSeconds);
  const actionLifecycle = deriveLifecycle(gift, snap.chainNow);
  const theme = metaQuery.data?.status === "ok" ? metaQuery.data.metadata.theme : "night-sky";
  const note = metaQuery.data?.status === "ok" ? metaQuery.data.metadata.note : null;
  const noteStatus = metaQuery.isPending ? "loading" : (metaQuery.data?.status ?? "unavailable");

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["gift", ACTIVE.chain.id, id.toString()] });
    await queryClient.invalidateQueries({ queryKey: ["gift-proof", ACTIVE.chain.id, id.toString()] });
  };

  return (
    <Shell>
      <div style={{ display: "grid", gap: 24 }} className="grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <GiftReveal key={id.toString()} theme={theme} note={note} noteStatus={noteStatus} amountText={`${formatBot(gift.amount, 6)} BOT`} />
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <GiftDetails gift={gift} lifecycle={lifecycle} nowSeconds={nowSeconds} proof={proofQuery.data} proofLoading={proofQuery.isFetching} proofFailed={proofQuery.isError || !!proofQuery.data?.failed} onRetryProof={() => void proofQuery.refetch()} />
          <GiftActions gift={gift} lifecycle={actionLifecycle} nowSeconds={nowSeconds} confirmingExpiry={confirmingExpiry} onConfirmed={refresh} />
        </div>
      </div>
    </Shell>
  );
}

function GiftDetails({
  gift,
  lifecycle,
  nowSeconds,
  proof,
  proofLoading,
  proofFailed,
  onRetryProof,
}: {
  gift: Gift;
  lifecycle: GiftLifecycle;
  nowSeconds: bigint;
  proof?: { created: string | null; action: string | null };
  proofLoading: boolean;
  proofFailed: boolean;
  onRetryProof: () => void;
}) {
  const { address } = useConnection();
  const [copied, setCopied] = useState(false);
  const life = LIFECYCLE_COPY[lifecycle];
  const expires = new Date(Number(gift.expiresAt) * 1000);
  const remaining = gift.expiresAt - nowSeconds;
  return (
    <section className="panel" aria-label="Gift details">
      <p style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: life.tone }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: "currentColor" }} />
        {life.label}
      </p>
      <h1 className="display-2" style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", marginTop: 6 }}>
        <span className="numeral">{formatBot(gift.amount, 6)} BOT</span>
      </h1>
      <p className="muted">Gift number {gift.giftId.toString()} on {ACTIVE.label}</p>
      <div style={{ marginTop: 16 }}>
        <AddressRow label="From" address={gift.sender} you={sameAddress(address, gift.sender)} />
        <AddressRow label="For" address={gift.recipient} you={sameAddress(address, gift.recipient)} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "1px solid var(--hairline)" }}>
          <span className="muted">{lifecycle === "claimable" ? "Expires" : "Expiry"}</span>
          <span style={{ fontWeight: 500, textAlign: "right" }}>
            {expires.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            {lifecycle === "claimable" ? <span className="muted"> (in {formatRemaining(remaining)})</span> : null}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ minHeight: 40, fontSize: 14 }}
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true), () => {});
          }}
        >
          {copied ? "Link copied" : "Copy share link"}
        </button>
        {ACTIVE.vault ? (
          <a className="btn btn-ghost" style={{ minHeight: 40, fontSize: 14 }} href={addressUrl(ACTIVE.vault)} target="_blank" rel="noreferrer">
            Vault on explorer
          </a>
        ) : null}
        {proof?.created ? (
          <a className="btn btn-ghost" style={{ minHeight: 40, fontSize: 14 }} href={txUrl(proof.created)} target="_blank" rel="noreferrer">
            Funding transaction
          </a>
        ) : null}
        {proof?.action ? (
          <a className="btn btn-ghost" style={{ minHeight: 40, fontSize: 14 }} href={txUrl(proof.action)} target="_blank" rel="noreferrer">
            {lifecycle === "claimed" ? "Claim transaction" : "Reclaim transaction"}
          </a>
        ) : null}
      </div>
      {proofLoading ? <p className="help">Looking up transaction proof...</p> : null}
      {!proofLoading && proofFailed ? (
        <p className="help" role="status">
          Some transaction links could not be loaded from the network. The gift details above are read directly from the chain and are not affected.{" "}
          <button type="button" onClick={onRetryProof} style={{ textDecoration: "underline", background: "none", border: 0, color: "inherit", cursor: "pointer", padding: 0 }}>
            Try again
          </button>
        </p>
      ) : null}
    </section>
  );
}

export function GiftActions({
  gift,
  lifecycle,
  nowSeconds,
  confirmingExpiry = false,
  onConfirmed,
}: {
  gift: Gift;
  lifecycle: GiftLifecycle;
  nowSeconds: bigint;
  confirmingExpiry?: boolean;
  onConfirmed: () => Promise<void>;
}) {
  const { address, isConnected, chainId } = useConnection();
  const { mutate: switchChain, isPending: switching } = useSwitchChain();
  const action: GiftAction = resolveGiftAction(isConnected ? address : null, gift, lifecycle);
  const wrongChain = isConnected && chainId !== ACTIVE.chain.id;
  const { phase, run, reset } = useVaultTx();
  const { data: balance } = useBalance({ address, chainId: ACTIVE.chain.id, query: { enabled: !!address } });
  const fn = action === "claim" ? "claim" : action === "reclaim" ? "reclaim" : null;
  const gas = useGasEstimate(fn && !wrongChain ? { functionName: fn, args: [gift.giftId] } : null);
  const [doneKind, setDoneKind] = useState<"claim" | "reclaim" | null>(null);

  const noGas = balance !== undefined && (balance.value === 0n || (gas.cost !== null && balance.value < gas.cost));
  const busy = phase.step === "checking" || phase.step === "signing" || phase.step === "pending";

  const submit = async (kind: "claim" | "reclaim") => {
    reset();
    const receipt = await run({
      functionName: kind,
      args: [gift.giftId],
      verify: (r) => confirmActionReceipt(r, ACTIVE.vault!, kind === "claim" ? "GiftClaimed" : "GiftReclaimed", gift.giftId),
    });
    if (receipt) {
      setDoneKind(kind);
      await onConfirmed();
    }
  };

  const confirmed = phase.step === "confirmed";

  return (
    <section className="panel" aria-label="Gift actions">
      {action === "connect" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <h2 className="heading-3">Connect to claim</h2>
          <p className="muted">
            This gift is for <strong style={{ color: "#fff" }}>{shortAddress(gift.recipient)}</strong>. Connect that wallet to claim it. This page link stays
            the same, so you can come back any time before it expires.
          </p>
          <ConnectPanel />
        </div>
      ) : null}

      {action === "claim" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <h2 className="heading-3">This one is yours</h2>
          <p className="muted">
            Claiming sends {formatBot(gift.amount, 6)} BOT to your wallet. The network charges a small gas fee in BOT, so your wallet needs a little BOT to
            claim{gas.cost !== null ? ` (about ${formatBot(gas.cost, 6)} BOT right now)` : ""}.
          </p>
          {wrongChain ? (
            <button type="button" className="btn btn-ember" disabled={switching} onClick={() => switchChain({ chainId: ACTIVE.chain.id })}>
              {switching ? "Check your wallet..." : `Switch to ${ACTIVE.label}`}
            </button>
          ) : (
            <>
              {noGas && !confirmed ? (
                <p className="help help-error" role="alert">
                  Your wallet has {balance ? formatBot(balance.value, 6) : "0"} BOT, which may not cover the network fee. The gift is safe and stays claimable until it expires.
                  {ACTIVE.isTestnet ? " Get free test BOT from the faucet, then come back." : " Add a little BOT, then come back."}
                </p>
              ) : null}
              <button type="button" className="btn btn-ember" disabled={busy || confirmed} onClick={() => void submit("claim")}>
                {busy ? "Working..." : confirmed ? "Claimed" : "Claim Gift"}
              </button>
            </>
          )}
        </div>
      ) : null}

      {action === "wrong-recipient" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <h2 className="heading-3">This gift belongs to someone else</h2>
          <p className="muted">
            It was sent to {shortAddress(gift.recipient)}, and you are connected as {address ? shortAddress(address) : "another wallet"}. Only the nominated
            wallet can claim it. Switch accounts in your wallet if you own that address.
          </p>
        </div>
      ) : null}

      {action === "sender-waiting" ? (
        <div style={{ display: "grid", gap: 10 }}>
          <h2 className="heading-3">You sent this gift</h2>
          <p style={{ fontWeight: 500 }}>Your gift is waiting to be claimed by {shortAddress(gift.recipient)}.</p>
          <p className="muted">
            If they do not claim it before {new Date(Number(gift.expiresAt) * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}, you can take your BOT back from this page.
            Until then the gift stays locked in the vault, so reclaim is not available yet.
          </p>
          <p className="numeral" style={{ fontSize: 16 }} role="status">
            {confirmingExpiry ? "Checking the chain to confirm the expiry..." : `Reclaim available in ${formatRemaining(gift.expiresAt - nowSeconds)}.`}
          </p>
        </div>
      ) : null}

      {action === "reclaim" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <h2 className="heading-3">Take your BOT back</h2>
          <p className="muted">
            This gift expired unclaimed, so you can reclaim {formatBot(gift.amount, 6)} BOT to your wallet. A small BOT gas fee applies
            {gas.cost !== null ? ` (about ${formatBot(gas.cost, 6)} BOT)` : ""}.
          </p>
          {wrongChain ? (
            <button type="button" className="btn btn-ember" disabled={switching} onClick={() => switchChain({ chainId: ACTIVE.chain.id })}>
              Switch to {ACTIVE.label}
            </button>
          ) : (
            <>
              {noGas && !confirmed ? (
                <p className="help help-error" role="alert">
                  Your wallet needs a little BOT to pay the network fee ({balance ? formatBot(balance.value, 6) : "0"} BOT available).
                  Your gift is safe in the vault and stays reclaimable.{ACTIVE.isTestnet ? " Get free test BOT from the faucet, then come back." : ""}
                </p>
              ) : null}
              <button type="button" className="btn btn-ember" disabled={busy || confirmed || noGas} onClick={() => void submit("reclaim")}>
                {busy ? "Working..." : confirmed ? "Reclaimed" : "Reclaim Gift"}
              </button>
            </>
          )}
        </div>
      ) : null}

      {action === "expired-view" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <h2 className="heading-3">This gift has expired</h2>
          <p className="muted">
            It was not claimed in time, so it can no longer be claimed. Only the sender ({shortAddress(gift.sender)}) can take the BOT back.
            {!isConnected ? ` To reclaim it, connect the original sender wallet (${shortAddress(gift.sender)}).` : ""}
          </p>
          {!isConnected ? <ConnectPanel /> : null}
        </div>
      ) : null}

      {action === "none" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <h2 className="heading-3">
            {lifecycle === "claimed" ? "Already claimed" : lifecycle === "reclaimed" ? "Reclaimed by the sender" : "Nothing to do here"}
          </h2>
          <p className="muted">
            {lifecycle === "claimed"
              ? `${formatBot(gift.amount, 6)} BOT was delivered to ${shortAddress(gift.recipient)}. This is final and recorded on chain.`
              : lifecycle === "reclaimed"
                ? `The gift expired unclaimed and ${formatBot(gift.amount, 6)} BOT went back to ${shortAddress(gift.sender)}.`
                : "This gift has no funds in the vault."}
          </p>
        </div>
      ) : null}

      <TxStatus
        phase={phase}
        successText={doneKind === "claim" ? "Claimed. The BOT is in your wallet." : doneKind === "reclaim" ? "Reclaimed. The BOT is back in your wallet." : undefined}
      />
    </section>
  );
}
