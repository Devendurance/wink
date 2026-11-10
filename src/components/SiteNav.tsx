"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIVE } from "@/lib/network";
import { WalletButton, WalletPanel, WrongChainBanner } from "./WalletButton";

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

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/**
 * Below 1024px the header holds only the wordmark and the hamburger. Every other
 * control lives in the menu sheet. Visibility uses wrapper elements and Tailwind
 * breakpoints only, because unlayered component CSS such as .btn would otherwise
 * override Tailwind's layered display utilities.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close(true);
        return;
      }
      if (e.key !== "Tab" || !menuRef.current) return;
      // Keep focus inside the toggle and the menu while it is open.
      const items = [toggleRef.current, ...menuRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(Boolean) as HTMLElement[];
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    // Move focus into the sheet so keyboard and screen reader users land in it.
    menuRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  // Resizing up to desktop closes the sheet so it can never linger hidden.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <header ref={headerRef} style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(5,5,5,0.88)", backdropFilter: "blur(16px)" }}>
      <WrongChainBanner />
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-[1360px] items-center justify-between gap-4 lg:h-[72px]"
        style={{ padding: "0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left))" }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="numeral" style={{ fontSize: 22, letterSpacing: "-0.02em" }} onClick={() => close()}>
            Wink
          </Link>
          <div className="hidden lg:block">
            <NetworkPill />
          </div>
        </div>

        <div className="hidden items-center gap-8 lg:flex">
          <ul className="flex items-center gap-8" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="nav-link" style={{ fontWeight: 500, fontSize: 14, opacity: 0.85 }}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <WalletButton />
            <Link href="/create" className="btn btn-ember" style={{ minHeight: 44 }}>
              Create a gift
            </Link>
          </div>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="grid size-11 shrink-0 cursor-pointer place-items-center border-0 bg-transparent lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden className="grid w-6 gap-1.5">
            <span className="block h-0.5 rounded bg-white" style={{ transition: "transform 160ms", transform: open ? "translateY(8px) rotate(45deg)" : undefined }} />
            <span className="block h-0.5 rounded bg-white" style={{ opacity: open ? 0 : 1 }} />
            <span className="block h-0.5 rounded bg-white" style={{ transition: "transform 160ms", transform: open ? "translateY(-8px) rotate(-45deg)" : undefined }} />
          </span>
        </button>
      </nav>

      {open ? (
        <div className="lg:hidden" style={{ borderTop: "1px solid var(--hairline)" }}>
          <div
            id="mobile-menu"
            ref={menuRef}
            tabIndex={-1}
            role="region"
            aria-label="Menu"
            className="mx-auto grid w-full max-w-[1360px] gap-5 overflow-y-auto overflow-x-hidden"
            style={{
              maxHeight: "calc(100dvh - 64px)",
              padding: "20px max(16px, env(safe-area-inset-right)) calc(28px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
              outline: "none",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="muted" style={{ fontSize: 13 }}>Network</span>
              <NetworkPill />
            </div>
            <div className="panel" style={{ padding: 16, minWidth: 0 }}>
              <WalletPanel />
            </div>
            <Link href="/create" className="btn btn-ember" onClick={() => close()}>
              Create a gift
            </Link>
            <ul className="grid gap-1" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => close()}
                    className="flex items-center"
                    style={{ minHeight: 48, padding: "0 4px", fontWeight: 500, fontSize: 17, borderBottom: "1px solid var(--hairline)" }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </header>
  );
}
