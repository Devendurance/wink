"use client";

import type { TxPhase } from "@/lib/useVaultTx";
import { txUrl } from "@/lib/network";

const STEP_COPY: Record<string, string> = {
  checking: "Checking everything with the network...",
  signing: "Waiting for you to confirm in your wallet.",
  pending: "Sent. Waiting for the network to confirm.",
};

/** Honest transaction status. Never shows success without a verified receipt. */
export function TxStatus({ phase, successText }: { phase: TxPhase; successText?: string }) {
  if (phase.step === "idle") return null;
  const busy = phase.step === "checking" || phase.step === "signing" || phase.step === "pending";
  const isError = phase.step === "error";
  const hash = "hash" in phase ? phase.hash : undefined;
  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live="polite"
      style={{
        marginTop: 16,
        padding: "14px 18px",
        borderRadius: 16,
        background: isError ? "rgba(255,107,139,0.12)" : phase.step === "confirmed" ? "rgba(190,227,26,0.12)" : "rgba(108,99,255,0.14)",
        border: `1px solid ${isError ? "rgba(255,107,139,0.4)" : phase.step === "confirmed" ? "rgba(190,227,26,0.4)" : "rgba(108,99,255,0.4)"}`,
      }}
    >
      <p style={{ fontWeight: 700 }}>
        {busy ? (
          <span aria-hidden className="breathe" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "var(--periwinkle)", marginRight: 8 }} />
        ) : null}
        {phase.step === "error" ? phase.error.message : phase.step === "confirmed" ? (successText ?? "Confirmed on chain.") : STEP_COPY[phase.step]}
      </p>
      {hash ? (
        <p style={{ marginTop: 6, fontSize: 13 }}>
          <a href={txUrl(hash)} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
            View transaction on the explorer
          </a>
        </p>
      ) : null}
    </div>
  );
}
