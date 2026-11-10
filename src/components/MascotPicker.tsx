"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { MASCOTS, Mascot } from "./Mascot";

const KEY = "wink.profile";
interface Profile {
  mascot: string;
  name: string;
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
function parse(raw: string): Profile {
  try {
    const p = JSON.parse(raw) as Partial<Profile>;
    if (typeof p.mascot === "string" && MASCOTS.some((m) => m.id === p.mascot)) return { mascot: p.mascot, name: typeof p.name === "string" ? p.name.slice(0, 24) : "" };
  } catch {
    // fall through
  }
  return { mascot: MASCOTS[0].id, name: "" };
}
function write(p: Profile) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage blocked. The picker still works for this visit.
  }
  listeners.forEach((l) => l());
}

/** Mascot and display name. Saved on this device only, never on chain or the server. */
export function MascotPicker() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  const stored = parse(raw);
  const [override, setOverride] = useState<Profile | null>(null);
  const profile = override ?? stored;
  const update = (next: Profile) => {
    setOverride(next);
    write(next);
  };
  const current = MASCOTS.find((m) => m.id === profile.mascot) ?? MASCOTS[0];
  const grid = MASCOTS.slice(0, 4);
  const more = MASCOTS.slice(4);

  return (
    <div className="frame-white" style={{ maxWidth: 1360, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 24px" }}>
        <span className="numeral" style={{ fontSize: 20 }}>Wink</span>
        <span style={{ fontSize: 13, color: "#6b6b75" }}>Saved on this device only</span>
      </div>
      <div style={{ display: "grid", gap: 16 }} className="grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
        <div className="graphite" style={{ padding: 32, display: "grid", gap: 16, justifyItems: "center", textAlign: "center", color: "#fff" }}>
          <h2 className="display-2" style={{ fontSize: "clamp(2rem, 4vw, 2.5rem)" }}>Choose your mascot</h2>
          <div className="float" style={{ width: 200, height: 210 }} key={current.id}>
            <Mascot mascot={current} title={`${current.name} mascot`} className="fade-up" />
          </div>
          <p style={{ color: "rgba(255,255,255,0.8)" }}>{current.name} will sit next to your name when you send and open gifts.</p>
          <div style={{ width: "100%", maxWidth: 360, textAlign: "left" }}>
            <label className="field-label" htmlFor="display-name">Display name</label>
            <input id="display-name" className="field" placeholder="What should friends call you?" maxLength={24} value={profile.name} onChange={(e) => update({ ...profile, name: e.target.value })} />
          </div>
          <Link href="/create" className="btn btn-white" style={{ minHeight: 52, width: "100%", maxWidth: 360 }}>Continue</Link>
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            {grid.map((m) => (
              <MascotCard key={m.id} id={m.id} selected={profile.mascot === m.id} onChoose={() => update({ ...profile, mascot: m.id })} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", color: "#0a0a0a" }}>
            <span style={{ fontSize: 13, color: "#6b6b75" }}>More friends</span>
            {more.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-label={`Choose ${m.name}`}
                aria-pressed={profile.mascot === m.id}
                onClick={() => update({ ...profile, mascot: m.id })}
                style={{ width: 48, height: 48, borderRadius: 999, background: m.colour, border: profile.mascot === m.id ? "3px solid #0a0a0a" : "3px solid transparent", cursor: "pointer", padding: 4 }}
              >
                <Mascot mascot={m} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MascotCard({ id, selected, onChoose }: { id: string; selected: boolean; onChoose: () => void }) {
  const m = MASCOTS.find((x) => x.id === id)!;
  return (
    <div
      className="mascot-card mc-card grain"
      onClick={onChoose}
      style={{ background: m.colour, color: m.ink, borderRadius: 28, minHeight: 280, minWidth: 0, display: "grid", gridTemplateRows: "auto 1fr auto", cursor: "pointer", outline: selected ? "3px solid #fff" : "none", boxShadow: selected ? `0 0 0 9px ${m.colour}` : undefined }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3 className="numeral" style={{ fontSize: 20, fontWeight: 600 }}>{m.name}</h3>
      </div>
      <div className="mascot-art" style={{ display: "grid", placeItems: "center" }}>
        <Mascot mascot={m} className="mx-auto h-auto w-full max-w-[150px]" />
      </div>
      <div className="mc-foot">
        <span style={{ fontSize: 12, fontWeight: 500, maxWidth: 96 }}>{m.trait}</span>
        <button
          type="button"
          className={selected ? "btn" : "btn btn-white"}
          style={{ minHeight: 40, padding: "0 20px", fontSize: 14, background: selected ? "#0a0a0a" : undefined, color: selected ? "#fff" : undefined }}
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation();
            onChoose();
          }}
        >
          {selected ? "Chosen ✓" : "Choose"}
        </button>
      </div>
    </div>
  );
}
