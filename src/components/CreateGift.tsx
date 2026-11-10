"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBalance, useConnection, usePublicClient, useSwitchChain } from "wagmi";
import { createMetadataHash, GIFT_THEMES, MAX_NOTE_CHARS, MetadataValidationError, type GiftTheme } from "@/lib/metadata";
import { MetadataSaveError, saveGiftMetadata } from "@/lib/giftClient";
import {
  MAX_HOURS,
  MIN_HOURS,
  computeExpiry,
  formatBot,
  giftIdFromCreateReceipt,
  insufficientForGift,
  shortAddress,
  validateAmount,
  validateHours,
  validateRecipient,
} from "@/lib/giftRules";
import { ACTIVE } from "@/lib/network";
import { THEMES } from "@/lib/themes";
import { useGasEstimate, useVaultTx } from "@/lib/useVaultTx";
import { GiftBox } from "./GiftBox";
import { TxStatus } from "./TxStatus";
import { ConnectPanel } from "./WalletButton";

const PRESETS = [
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "14 days", hours: 336 },
];

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="help help-error" role="alert">
      {message}
    </p>
  ) : null;
}

export function CreateGift() {
  const router = useRouter();
  const { address, isConnected, chainId } = useConnection();
  const { mutate: switchChain, isPending: switching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: ACTIVE.chain.id });
  const { data: balance } = useBalance({ address, chainId: ACTIVE.chain.id, query: { enabled: !!address } });
  const { phase, run, reset } = useVaultTx();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [theme, setTheme] = useState<GiftTheme>("sunrise");
  const [note, setNote] = useState("");
  const [hours, setHours] = useState("168");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [stage, setStage] = useState<"idle" | "saving" | "tx">("idle");
  const [metaError, setMetaError] = useState<string | null>(null);
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const recipientR = validateRecipient(recipient, address);
  const amountR = validateAmount(amount);
  const hoursR = validateHours(hours);
  const noteInfo = useMemo(() => {
    try {
      const r = createMetadataHash({ v: 1, theme, note });
      return { ok: true as const, hash: r.hash };
    } catch (err) {
      return { ok: false as const, error: err instanceof MetadataValidationError ? err.message : "That note could not be read." };
    }
  }, [theme, note]);
  const noteLength = [...note.trim()].length;

  const chainTime = useQuery({
    queryKey: ["chain-now", ACTIVE.chain.id],
    enabled: !!publicClient,
    refetchInterval: 30_000,
    queryFn: async () => (await publicClient!.getBlock({ blockTag: "latest" })).timestamp,
  });

  const formValid = recipientR.ok && amountR.ok && hoursR.ok && noteInfo.ok;
  const gasCall =
    formValid && chainId === ACTIVE.chain.id && chainTime.data !== undefined
      ? {
          functionName: "createGift" as const,
          args: [recipientR.value, computeExpiry(chainTime.data, hoursR.value), noteInfo.hash] as const,
          value: amountR.value,
        }
      : null;
  const gas = useGasEstimate(gasCall);

  const wrongChain = isConnected && chainId !== ACTIVE.chain.id;
  const tooPoor =
    formValid && balance !== undefined && insufficientForGift(balance.value, amountR.value, gas.cost ?? 0n);
  const busy = stage !== "idle" && phase.step !== "error" && phase.step !== "confirmed";
  const disabledNet = !ACTIVE.vault;

  const submit = async () => {
    setTouched({ recipient: true, amount: true, note: true, hours: true });
    if (!formValid || !address || !publicClient || !ACTIVE.vault) return;
    reset();
    setMetaError(null);
    setStage("saving");
    let hash;
    try {
      hash = await saveGiftMetadata({ theme, note });
    } catch (err) {
      setMetaError(err instanceof MetadataSaveError ? err.message : "Your message could not be saved. Nothing was sent from your wallet.");
      setStage("idle");
      return;
    }
    setStage("tx");
    let expiresAt: bigint;
    try {
      const block = await publicClient.getBlock({ blockTag: "latest" });
      expiresAt = computeExpiry(block.timestamp, hoursR.value);
    } catch {
      setMetaError("The BOT Chain network did not respond, so nothing was sent. Try again in a moment.");
      setStage("idle");
      return;
    }
    const vault = ACTIVE.vault;
    let giftId: bigint | null = null;
    const receipt = await run({
      functionName: "createGift",
      args: [recipientR.value, expiresAt, hash],
      value: amountR.value,
      verify: (r) => {
        giftId = giftIdFromCreateReceipt(r, vault, { sender: address, recipient: recipientR.value, amount: amountR.value, metadataHash: hash });
      },
    });
    setStage("idle");
    // giftId can be 0n, so compare with null explicitly.
    if (receipt && giftId !== null) router.push(`/g/${(giftId as bigint).toString()}`);
  };

  const t = THEMES[theme];
  const previewNote = noteInfo.ok && note.trim() ? note.trim() : "Your note appears here.";
  const err = {
    recipient: touched.recipient && !recipientR.ok ? recipientR.error : undefined,
    amount: touched.amount && !amountR.ok ? amountR.error : undefined,
    hours: touched.hours && !hoursR.ok ? hoursR.error : undefined,
    note: touched.note && !noteInfo.ok ? noteInfo.error : undefined,
  };

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "40px clamp(16px, 3vw, 40px) 96px" }}>
      <h1 className="display-2">Create a gift</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 560 }}>
        Fund a gift with BOT, add a note, and share the link. {ACTIVE.isTestnet ? "This is the test network, so nothing here has real value." : ""}
      </p>

      {disabledNet ? (
        <div className="panel" role="alert" style={{ marginTop: 32 }}>
          <p className="heading-3">Gift creation is not live on {ACTIVE.label} yet</p>
          <p className="muted">The Wink vault has not been deployed to this network.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 24, marginTop: 32 }} className="grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <form
            className="panel"
            style={{ display: "grid", gap: 24 }}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <label className="field-label" htmlFor="recipient">Who is it for?</label>
              <input id="recipient" className="field" placeholder="Recipient wallet address (0x...)" value={recipient} autoComplete="off" spellCheck={false} aria-invalid={!!err.recipient} aria-describedby="recipient-err recipient-help" onBlur={() => touch("recipient")} onChange={(e) => setRecipient(e.target.value)} />
              <FieldError id="recipient-err" message={err.recipient} />
              <p id="recipient-help" className="help">Only this wallet will be able to claim the gift.</p>
            </div>

            <div>
              <label className="field-label" htmlFor="amount">How much BOT?</label>
              <input id="amount" className="field" inputMode="decimal" placeholder="0.5" value={amount} autoComplete="off" aria-invalid={!!err.amount} aria-describedby="amount-err" onBlur={() => touch("amount")} onChange={(e) => setAmount(e.target.value)} />
              <FieldError id="amount-err" message={err.amount} />
            </div>

            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend className="field-label">Pick a look</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }} role="radiogroup" aria-label="Gift theme">
                {GIFT_THEMES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={theme === id}
                    onClick={() => setTheme(id)}
                    style={{ textAlign: "left", padding: 12, borderRadius: 20, cursor: "pointer", color: "#fff", background: "var(--n700)", border: theme === id ? "2px solid #fff" : "2px solid transparent", minHeight: 44 }}
                  >
                    <span style={{ display: "block", height: 44, borderRadius: 12, background: THEMES[id].swatch }} aria-hidden />
                    <span className="numeral" style={{ display: "block", marginTop: 8, fontSize: 15 }}>{THEMES[id].label}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{THEMES[id].blurb}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="field-label" htmlFor="note">Your note</label>
              <textarea id="note" className="field" placeholder="Happy birthday. Buy yourself something fun." value={note} maxLength={MAX_NOTE_CHARS * 2} aria-invalid={!!err.note} aria-describedby="note-err note-count" onBlur={() => touch("note")} onChange={(e) => setNote(e.target.value)} />
              <FieldError id="note-err" message={err.note} />
              <p id="note-count" className="help" style={{ textAlign: "right" }}>{noteLength} / {MAX_NOTE_CHARS}</p>
            </div>

            <div>
              <label className="field-label" htmlFor="hours">How long can they claim it?</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {PRESETS.map((p) => (
                  <button key={p.hours} type="button" className="btn btn-ghost" aria-pressed={hours === String(p.hours)} style={{ minHeight: 40, padding: "0 16px", fontSize: 14, background: hours === String(p.hours) ? "#fff" : undefined, color: hours === String(p.hours) ? "#0a0a0a" : undefined }} onClick={() => { setHours(String(p.hours)); touch("hours"); }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input id="hours" className="field" inputMode="numeric" value={hours} aria-invalid={!!err.hours} aria-describedby="hours-err hours-help" onBlur={() => touch("hours")} onChange={(e) => setHours(e.target.value)} />
              <FieldError id="hours-err" message={err.hours} />
              <p id="hours-help" className="help">Hours from now, between {MIN_HOURS} and {MAX_HOURS}. If nobody claims it in time, you can take the BOT back.</p>
            </div>

            <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 20, display: "grid", gap: 8 }}>
              <Row label="Gift" value={amountR.ok ? `${formatBot(amountR.value, 6)} BOT` : "-"} />
              <Row label="Estimated network fee" value={gas.cost !== null ? `~${formatBot(gas.cost, 6)} BOT` : gas.loading ? "Estimating..." : "Shown once the form is complete"} />
              <Row label="Your balance" value={balance ? `${formatBot(balance.value, 4)} BOT` : isConnected ? "..." : "Connect a wallet"} />
              {tooPoor ? (
                <p className="help help-error" role="alert">
                  Your balance does not cover the gift plus the network fee.{ACTIVE.isTestnet ? " Get free test BOT from the faucet first." : ""}
                </p>
              ) : null}
            </div>

            {metaError ? (
              <p className="help help-error" role="alert" style={{ fontSize: 14 }}>{metaError}</p>
            ) : null}

            {!isConnected ? (
              <div>
                <p className="muted" style={{ marginBottom: 12 }}>Connect a wallet to fund this gift.</p>
                <ConnectPanel />
              </div>
            ) : wrongChain ? (
              <button type="button" className="btn btn-ember" disabled={switching} onClick={() => switchChain({ chainId: ACTIVE.chain.id })}>
                {switching ? "Check your wallet..." : `Switch to ${ACTIVE.label}`}
              </button>
            ) : (
              <button type="submit" className="btn btn-ember" disabled={busy || !!tooPoor}>
                {stage === "saving" ? "Saving your note..." : busy ? "Working..." : `Fund and create gift${amountR.ok ? ` (${formatBot(amountR.value, 6)} BOT)` : ""}`}
              </button>
            )}
            <TxStatus phase={phase} successText="Funded. Opening your gift page..." />
          </form>

          <aside aria-label="Gift preview" style={{ alignSelf: "start" }} className="lg:sticky lg:top-24">
            <p className="field-label">Preview</p>
            <div className={`${t.surface} grain`} style={{ borderRadius: 40, padding: 28, color: t.ink, textAlign: "center", display: "grid", gap: 14, justifyItems: "center" }}>
              <div className="float" style={{ width: 170, height: 170 }}><GiftBox colour={t.box} /></div>
              <p className="numeral" style={{ fontSize: 32 }}>{amountR.ok ? `${formatBot(amountR.value, 6)} BOT` : "0 BOT"}</p>
              <p style={{ fontWeight: 500 }}>For {recipientR.ok ? shortAddress(recipientR.value) : "someone special"}</p>
              <div style={{ background: t.surface === "stage-navy" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)", color: t.surface === "stage-navy" ? "#fff" : "#0a0a0a", borderRadius: 20, padding: "14px 18px", width: "100%", textAlign: "left", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {previewNote}
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, opacity: 0.75 }}>
                Claimable for {hoursR.ok ? `${hoursR.value} hours` : "..."} after you fund it.
              </p>
            </div>
            <p className="help">Your note is public once the gift is shared. Never put secrets in it. The gift page only exists after your funding transaction confirms.</p>
          </aside>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}
