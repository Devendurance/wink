"use client";

import { useRef, useState } from "react";
import { GiftBox } from "./GiftBox";
import { THEMES } from "@/lib/themes";
import type { GiftTheme } from "@/lib/metadata";
import { fireConfetti, prefersReducedMotion, squash, useShake, wobble } from "@/lib/motion";

interface Props {
  theme: GiftTheme;
  /** Message text, or null when the message is unavailable. */
  note: string | null;
  noteStatus: "ok" | "missing" | "unavailable" | "malformed" | "corrupted" | "loading";
  amountText: string;
  /** Skip the unwrap ceremony, for previews. */
  startOpen?: boolean;
}

/**
 * Gift reveal. Tap the box, press OPEN, or shake a phone. This block is purely
 * presentational and sits beside the transaction actions, never in front of them.
 */
export function GiftReveal({ theme, note, noteStatus, amountText, startOpen = false }: Props) {
  const t = THEMES[theme];
  const [opened, setOpened] = useState(startOpen);
  const boxRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [lidUp, setLidUp] = useState(startOpen);

  const open = () => {
    if (opened || lidUp) return;
    if (prefersReducedMotion()) {
      setOpened(true);
      setLidUp(true);
      return;
    }
    // Never wait on the animation clock: the reveal must complete even if the
    // tab is throttled or the animation library is slow.
    void squash(boxRef.current);
    setLidUp(true);
    fireConfetti(stageRef.current, 60);
    window.setTimeout(() => setOpened(true), 450);
  };

  const requestMotion = useShake(() => {
    wobble(boxRef.current, 1.4);
    open();
  }, !opened);

  const noteBody =
    noteStatus === "ok" && note !== null ? (
      <p style={{ fontSize: 18, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note}</p>
    ) : noteStatus === "loading" ? (
      <p className="muted">Loading the message...</p>
    ) : (
      <p className="muted">
        The personal message could not be shown{" "}
        {noteStatus === "corrupted" ? "because it failed an integrity check" : noteStatus === "malformed" ? "because it could not be read" : noteStatus === "missing" ? "because it was not found" : "right now"}, but the gift itself below is
        exactly as recorded on chain.
      </p>
    );

  return (
    <div
      ref={stageRef}
      className={`${t.surface} grain`}
      style={{ position: "relative", borderRadius: 40, padding: "28px 24px 32px", color: t.ink, overflow: "hidden", minHeight: 440, display: "grid", placeItems: "center", textAlign: "center" }}
    >
      {!opened ? (
        <div style={{ display: "grid", gap: 16, justifyItems: "center", width: "100%", maxWidth: 360 }}>
          <p className="heading-3">A gift is waiting</p>
          <button
            type="button"
            aria-label="Tap the gift box to open it"
            onClick={() => {
              void requestMotion();
              open();
            }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <span ref={boxRef} className="float" style={{ display: "block", width: 200, height: 200 }}>
              <GiftBox colour={t.box} open={lidUp} />
            </span>
          </button>
          <button
            type="button"
            className="btn btn-open"
            style={{ maxWidth: 320 }}
            onClick={() => {
              void requestMotion();
              open();
            }}
          >
            Open
          </button>
          <p style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>Shake your phone or tap to open</p>
        </div>
      ) : (
        <div className="fade-up" style={{ display: "grid", gap: 16, justifyItems: "center", width: "100%", maxWidth: 420 }}>
          <div style={{ width: 120, height: 120 }}>
            <GiftBox colour={t.box} open />
          </div>
          <p className="numeral" style={{ fontSize: 34 }}>{amountText}</p>
          <div
            style={{
              background: t.surface === "stage-navy" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)",
              color: t.surface === "stage-navy" ? "#fff" : "#0a0a0a",
              borderRadius: 24,
              padding: "20px 22px",
              width: "100%",
              textAlign: "left",
            }}
          >
            {noteBody}
          </div>
        </div>
      )}
    </div>
  );
}
