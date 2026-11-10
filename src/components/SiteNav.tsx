"use client";

import Link from "next/link";
import { useState } from "react";
import { ACTIVE } from "@/lib/network";
import { WalletButton, WrongChainBanner } from "./WalletButton";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#occasions", label: "Occasions" },
  { href: "/#trust", label: "Safety" },
  { href: "/sent", label: "Sent gifts" },
];

export function NetworkPill() {
  return (
    <span
      title={`Connected to ${ACTIVE.label}, chain ${ACTIVE.chain.id}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: ACTIVE.isTestnet ? "rgba(190,227,26,0.14)" : "rgba(108,99,255,0.2)",
        color: ACTIVE.isTestnet ? "var(--lime)" : "#c9c5ff",
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
      {ACTIVE.isTestnet ? "Testnet" : "Mainnet"}
    </span>
  );
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(5,5,5,0.72)", backdropFilter: "blur(16px)" }}>
      <WrongChainBanner />
      <nav aria-label="Main" style={{ maxWidth: 1360, margin: "0 auto", height: 72, padding: "0 clamp(16px, 3vw, 40px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="numeral" style={{ fontSize: 22, letterSpacing: "-0.02em" }} onClick={() => setOpen(false)}>
            Wink
          </Link>
          <NetworkPill />
        </div>
        <ul className="hidden lg:flex" style={{ gap: 32, listStyle: "none", margin: 0, padding: 0 }}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="nav-link" style={{ fontWeight: 500, fontSize: 14, opacity: 0.85 }}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <WalletButton />
          <Link href="/create" className="btn btn-ember hidden sm:inline-flex" style={{ minHeight: 44 }}>
            Create a gift
          </Link>
          <button
            type="button"
            className="lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", cursor: "pointer" }}
          >
            <span aria-hidden style={{ display: "grid", gap: 6, width: 24 }}>
              <span style={{ height: 2, background: "#fff", borderRadius: 2 }} />
              <span style={{ height: 2, background: "#fff", borderRadius: 2 }} />
              <span style={{ height: 2, background: "#fff", borderRadius: 2 }} />
            </span>
          </button>
        </div>
      </nav>
      {open ? (
        <div id="mobile-menu" className="lg:hidden" style={{ padding: "8px 16px 24px", display: "grid", gap: 4, borderTop: "1px solid var(--hairline)" }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ padding: "14px 4px", fontWeight: 500, minHeight: 48 }}>
              {l.label}
            </Link>
          ))}
          <Link href="/create" className="btn btn-ember" style={{ marginTop: 12 }} onClick={() => setOpen(false)}>
            Create a gift
          </Link>
        </div>
      ) : null}
    </header>
  );
}
