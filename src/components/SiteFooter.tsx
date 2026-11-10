import Link from "next/link";
import { ACTIVE } from "@/lib/network";

export function SiteFooter() {
  return (
    <footer style={{ background: "var(--n900)", borderTop: "1px solid var(--hairline)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "64px clamp(16px, 3vw, 40px) 40px", display: "grid", gap: 40 }} className="md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="numeral" style={{ fontSize: 24 }}>Wink</p>
          <p className="muted" style={{ maxWidth: 360, marginTop: 8 }}>
            Send BOT with a note. They open it with a tap. If it is never opened, it comes back to you.
          </p>
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--n500)" }}>
            Built on BOT Chain. Currently running on {ACTIVE.label}
            {ACTIVE.isTestnet ? ". Test BOT has no real value." : "."}
          </p>
        </div>
        <div>
          <p className="numeral" style={{ fontSize: 14, marginBottom: 12 }}>Wink</p>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
            <li><Link href="/create">Create a gift</Link></li>
            <li><Link href="/sent">Gifts you sent</Link></li>
            <li><Link href="/#how">How it works</Link></li>
            <li><Link href="/#trust">Safety</Link></li>
          </ul>
        </div>
        <div>
          <p className="numeral" style={{ fontSize: 14, marginBottom: 12 }}>On chain</p>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
            {ACTIVE.vault ? (
              <li>
                <a href={`${ACTIVE.explorer}/address/${ACTIVE.vault}`} target="_blank" rel="noreferrer">
                  Vault contract
                </a>
              </li>
            ) : null}
            <li><a href={ACTIVE.explorer} target="_blank" rel="noreferrer">Block explorer</a></li>
            {ACTIVE.isTestnet ? (
              <li><a href="https://faucet.botchain.ai" target="_blank" rel="noreferrer">Testnet faucet</a></li>
            ) : null}
          </ul>
        </div>
      </div>
    </footer>
  );
}
