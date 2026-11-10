import Link from "next/link";
import { GiftBox, type BoxColour } from "@/components/GiftBox";
import { MASCOTS, Mascot } from "@/components/Mascot";
import { MascotPicker } from "@/components/MascotPicker";
import { ACTIVE } from "@/lib/network";

const WAVES = Array.from({ length: 14 }, (_, i) => i);

function Contours() {
  return (
    <svg className="contours" viewBox="0 0 1440 500" preserveAspectRatio="none" aria-hidden>
      {WAVES.map((i) => (
        <path
          key={i}
          d={`M0 ${40 + i * 30} C 240 ${i * 30 - 20}, 480 ${120 + i * 30}, 720 ${60 + i * 30} S 1200 ${i * 30}, 1440 ${70 + i * 30}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}

function Badge() {
  return (
    <svg viewBox="0 0 100 100" width="96" height="96" className="spin-slow" aria-hidden>
      <defs>
        <path id="circ" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" />
      </defs>
      <text fill="#fff" fontSize="9.5" fontWeight="700" letterSpacing="2.2" style={{ textTransform: "uppercase" }}>
        <textPath href="#circ">Shake · Tap · Open · Shake · Tap · Open ·</textPath>
      </text>
    </svg>
  );
}

interface FanCardProps {
  className: string;
  surface: string;
  box: BoxColour;
  boxTilt: number;
  title: string;
  subtitle: string;
  value: string;
  avatars: number[];
  perch?: boolean;
}

function FanCard({ className, surface, box, boxTilt, title, subtitle, value, avatars, perch }: FanCardProps) {
  return (
    <div className={`fan-card ${className}`}>
      <article
        className={`hero-card grain ${surface}`}
        style={{ position: "relative", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 40px 80px -30px rgba(120,140,255,0.5)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{title}</h3>
            <p style={{ fontSize: 14, fontWeight: 500 }}>{subtitle}</p>
            <p style={{ fontSize: 14, fontWeight: 500, opacity: 0.6, marginTop: 4 }}>Example amount</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex" }} aria-hidden>
              {avatars.map((a, i) => (
                <span key={i} style={{ width: 32, height: 32, borderRadius: 999, background: MASCOTS[a].colour, border: "2px solid #fff", marginLeft: i ? -12 : 0, overflow: "hidden", display: "grid", placeItems: "center" }}>
                  <Mascot mascot={MASCOTS[a]} />
                </span>
              ))}
            </div>
            <span className="numeral" style={{ fontSize: 16 }}>{value}</span>
          </div>
        </div>
        <div style={{ position: "absolute", left: "15%", width: "70%", bottom: "-6%", transform: `rotate(${boxTilt}deg)` }}>
          {perch ? (
            <div style={{ position: "absolute", width: "34%", left: "33%", top: "-6%", zIndex: 2 }}>
              <Mascot mascot={MASCOTS[4]} />
            </div>
          ) : null}
          <GiftBox colour={box} />
        </div>
      </article>
    </div>
  );
}

const STEPS = [
  { n: "1", title: "Fund it", body: "Pick the amount, write a note, choose a look. Your wallet sends the BOT into the Wink vault." },
  { n: "2", title: "Share the link", body: "You get a link to a private-feeling gift page. Send it however you like. Only the wallet you named can claim." },
  { n: "3", title: "They open it", body: "They shake or tap to unwrap the note, then claim the BOT. If nobody claims it in time, you take it back." },
];

const OCCASIONS = [
  { title: "Birthdays", body: "Skip the gift card. Send a little BOT with a note they will actually read.", surface: "grad-ember", box: "lavender" as BoxColour, ink: "#0a0a0a" },
  { title: "Thank yous", body: "A friend helped you move. Say thanks in a way that lands in their wallet.", surface: "grad-cyan", box: "pink" as BoxColour, ink: "#0a0a0a" },
  { title: "Just because", body: "Welcome a friend to BOT Chain with their first coins and a warm hello.", surface: "grad-violet", box: "lime" as BoxColour, ink: "#0a0a0a" },
];

const TRUST = [
  { title: "Only they can claim", body: "The contract checks the recipient address. Nobody else can take the gift, including us." },
  { title: "You can take it back", body: "If the gift expires unclaimed, only the sender can reclaim the BOT. There is no early cancel and no admin override." },
  { title: "Your note is public", body: "Notes are plain text stored by Wink and fingerprinted on chain. Keep secrets out of them." },
  { title: "Proof you can check", body: "Every step is a real transaction on BOT Chain with an explorer link. Nothing is simulated." },
];

export default function Home() {
  return (
    <>
      <section style={{ position: "relative", overflow: "hidden" }}>
        <Contours />
        <div style={{ position: "relative", maxWidth: 1360, margin: "0 auto", padding: "clamp(40px, 8vw, 96px) clamp(16px, 3vw, 40px) 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, justifyContent: "center", flexDirection: "column" }}>
            <div className="sm:absolute sm:left-10 sm:top-24">
              <Badge />
            </div>
            <h1 className="display-1" style={{ textAlign: "center" }}>
              Send A Gift
              <br />
              Worth Opening
            </h1>
            <p className="muted" style={{ maxWidth: 520, textAlign: "center", fontSize: 18 }}>
              Fund BOT, write a note, share a link. They shake or tap to unwrap it. Unclaimed gifts come back to you.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <Link href="/create" className="btn btn-ember">Create a Gift</Link>
              <Link href="/#how" className="btn btn-ghost" style={{ minHeight: 48 }}>How it works</Link>
            </div>
          </div>
          <p className="muted hidden xl:block" style={{ position: "absolute", right: 40, top: "24%", maxWidth: 200, fontSize: 15 }}>
            Every gift is a real BOT transfer held by a vault contract until the right person claims it.
          </p>
          <div className="fan" role="group" aria-label="Example gift cards">
            <FanCard className="fan-left" surface="grad-cyan" box="pink" boxTilt={8} title="Thank You Box" subtitle="Opens on shake or tap" value="0.5 BOT" avatars={[0, 2, 3]} />
            <FanCard className="fan-mid" surface="grad-ember" box="lavender" boxTilt={-6} title="Birthday Box" subtitle="Opens on shake or tap" value="1 BOT" avatars={[1, 4, 5, 6]} perch />
            <FanCard className="fan-right" surface="grad-violet" box="lime" boxTilt={-8} title="Just Because" subtitle="Opens on shake or tap" value="0.1 BOT" avatars={[7, 3]} />
          </div>
        </div>
      </section>

      <section id="how" style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(64px, 9vw, 128px) clamp(16px, 3vw, 40px) 0", scrollMarginTop: 80 }}>
        <h2 className="display-2">How gifting works</h2>
        <ol style={{ listStyle: "none", padding: 0, marginTop: 40, display: "grid", gap: 16 }} className="grid-cols-[minmax(0,1fr)] md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="panel" style={{ padding: 28 }}>
              <span className="numeral" style={{ fontSize: 40, color: "var(--ember)" }}>{s.n}</span>
              <h3 className="heading-3" style={{ marginTop: 8 }}>{s.title}</h3>
              <p className="muted" style={{ marginTop: 8 }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="occasions" style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(64px, 9vw, 128px) clamp(16px, 3vw, 40px) 0", scrollMarginTop: 80 }}>
        <h2 className="display-2">For every little moment</h2>
        <div style={{ display: "grid", gap: 16, marginTop: 40 }} className="grid-cols-[minmax(0,1fr)] md:grid-cols-3">
          {OCCASIONS.map((o) => (
            <article key={o.title} className={`hero-card grain ${o.surface}`} style={{ position: "relative", minHeight: 360, color: o.ink, borderRadius: 32 }}>
              <h3 style={{ fontSize: 24, fontWeight: 600 }}>{o.title}</h3>
              <p style={{ marginTop: 6, maxWidth: 260 }}>{o.body}</p>
              <div style={{ position: "absolute", width: "58%", right: "-2%", bottom: "-6%", transform: "rotate(8deg)" }}>
                <GiftBox colour={o.box} />
              </div>
            </article>
          ))}
        </div>
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link href="/create" className="btn btn-ember">Create a Gift</Link>
        </div>
      </section>

      <section style={{ padding: "clamp(64px, 9vw, 128px) clamp(8px, 2vw, 24px) 0" }} aria-label="Choose your mascot">
        <MascotPicker />
      </section>

      <section id="trust" style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(64px, 9vw, 128px) clamp(16px, 3vw, 40px) 0", scrollMarginTop: 80 }}>
        <h2 className="display-2">Built to be trusted</h2>
        <div style={{ display: "grid", gap: 16, marginTop: 40 }} className="grid-cols-[minmax(0,1fr)] sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="panel">
              <h3 className="numeral" style={{ fontSize: 18 }}>{t.title}</h3>
              <p className="muted" style={{ marginTop: 8 }}>{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(64px, 9vw, 128px) clamp(16px, 3vw, 40px) clamp(64px, 9vw, 112px)" }}>
        <div className="stage-navy" style={{ borderRadius: 40, padding: "clamp(32px, 6vw, 64px)", display: "grid", gap: 16, justifyItems: "start" }}>
          <h2 className="display-2">Powered by BOT Chain</h2>
          <p style={{ maxWidth: 560, color: "rgba(255,255,255,0.75)", fontSize: 18 }}>
            Wink uses BOT, the native coin of BOT Chain. Gifts live in an open, verified smart contract that anyone can inspect.
            {ACTIVE.isTestnet ? " You are on the test network, where the BOT is free and has no value." : ""}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {ACTIVE.vault ? (
              <a className="btn btn-white" href={`${ACTIVE.explorer}/address/${ACTIVE.vault}#code`} target="_blank" rel="noreferrer">View the vault contract</a>
            ) : null}
            <a className="btn btn-ghost" href={ACTIVE.explorer} target="_blank" rel="noreferrer">Open the explorer</a>
            {ACTIVE.isTestnet ? (
              <a className="btn btn-ghost" href="https://faucet.botchain.ai" target="_blank" rel="noreferrer">Get test BOT</a>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
