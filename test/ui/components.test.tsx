// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GiftView, GiftLifecycle } from "@/lib/chain";

const SENDER = "0x1111111111111111111111111111111111111111";
const RECIPIENT = "0x2222222222222222222222222222222222222222";
const STRANGER = "0x3333333333333333333333333333333333333333";

const wallet = { address: undefined as string | undefined, isConnected: false, chainId: 968 };

vi.mock("wagmi", () => ({
  useConnection: () => wallet,
  useBalance: () => ({ data: { value: 10n ** 18n } }),
  useSwitchChain: () => ({ mutate: vi.fn(), isPending: false }),
  useConnectors: () => [],
  useConnect: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useDisconnect: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/lib/useVaultTx", () => ({
  useVaultTx: () => ({ phase: { step: "idle" }, run: vi.fn(), reset: vi.fn() }),
  useGasEstimate: () => ({ cost: 21000n * 10n ** 9n, loading: false }),
}));

import { GiftActions } from "@/components/GiftView";
import { GiftReveal } from "@/components/GiftReveal";

const gift = (over: Partial<GiftView> = {}): GiftView => ({
  giftId: 0n,
  sender: SENDER as GiftView["sender"],
  recipient: RECIPIENT as GiftView["recipient"],
  amount: 10n ** 16n,
  expiresAt: 2000n,
  metadataHash: ("0x" + "11".repeat(32)) as GiftView["metadataHash"],
  state: "funded",
  ...over,
});

function setWallet(address: string | undefined, chainId = 968) {
  wallet.address = address;
  wallet.isConnected = !!address;
  wallet.chainId = chainId;
}

function renderActions(g: GiftView, lifecycle: GiftLifecycle) {
  return render(<GiftActions gift={g} lifecycle={lifecycle} onConfirmed={async () => {}} />);
}

afterEach(() => cleanup());

describe("gift actions UI", () => {
  it("guides a disconnected visitor to connect and shows no claim button", () => {
    setWallet(undefined);
    renderActions(gift(), "claimable");
    expect(screen.getByText("Connect to claim")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Claim Gift" })).toBeNull();
  });

  it("shows Claim Gift only to the nominated recipient and explains gas", () => {
    setWallet(RECIPIENT);
    renderActions(gift(), "claimable");
    expect(screen.getByRole("button", { name: "Claim Gift" })).toBeTruthy();
    expect(screen.getByText(/gas fee in BOT/i)).toBeTruthy();
  });

  it("never offers a functional claim to a wrong wallet", () => {
    setWallet(STRANGER);
    renderActions(gift(), "claimable");
    expect(screen.getByText("This gift belongs to someone else")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /claim/i })).toBeNull();
  });

  it("asks for a network switch instead of claiming on the wrong chain", () => {
    setWallet(RECIPIENT, 1);
    renderActions(gift(), "claimable");
    expect(screen.queryByRole("button", { name: "Claim Gift" })).toBeNull();
    expect(screen.getByRole("button", { name: /Switch to BOT Chain Testnet/ })).toBeTruthy();
  });

  it("shows Reclaim Gift only to the sender after expiry", () => {
    setWallet(SENDER);
    renderActions(gift(), "expired-awaiting-reclaim");
    expect(screen.getByRole("button", { name: "Reclaim Gift" })).toBeTruthy();
    cleanup();
    setWallet(RECIPIENT);
    renderActions(gift(), "expired-awaiting-reclaim");
    expect(screen.queryByRole("button", { name: "Reclaim Gift" })).toBeNull();
    expect(screen.getByText("This gift has expired")).toBeTruthy();
  });

  it("shows final states without any action button", () => {
    setWallet(RECIPIENT);
    renderActions(gift({ state: "claimed" }), "claimed");
    expect(screen.getByText("Already claimed")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    setWallet(SENDER);
    renderActions(gift({ state: "reclaimed" }), "reclaimed");
    expect(screen.getByText("Reclaimed by the sender")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("tells a sender their gift is still waiting before expiry", () => {
    setWallet(SENDER);
    renderActions(gift(), "claimable");
    expect(screen.getByText("You sent this gift")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /claim|reclaim/i })).toBeNull();
  });
});

function mockMotion(reduced: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduced && q.includes("reduce"),
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("gift reveal", () => {
  beforeEach(() => mockMotion(true));

  it("reveals the note immediately under reduced motion, with no confetti", () => {
    render(<GiftReveal theme="confetti" note="Happy birthday!" noteStatus="ok" amountText="0.01 BOT" />);
    expect(screen.queryByText("Happy birthday!")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Happy birthday!")).toBeTruthy();
    expect(screen.getByText("0.01 BOT")).toBeTruthy();
    expect(document.querySelectorAll("span[aria-hidden='true'][style*='background']").length).toBe(0);
  });

  it("falls back honestly when the message is unavailable or corrupted", () => {
    const { unmount } = render(<GiftReveal theme="sunrise" note={null} noteStatus="unavailable" amountText="0.01 BOT" startOpen />);
    expect(screen.getByText(/personal message could not be shown/i)).toBeTruthy();
    expect(screen.getByText("0.01 BOT")).toBeTruthy();
    unmount();
    render(<GiftReveal theme="sunrise" note={null} noteStatus="corrupted" amountText="0.01 BOT" startOpen />);
    expect(screen.getByText(/failed an integrity check/i)).toBeTruthy();
  });

  it("stays open when the message finishes loading after the visitor opened the gift", () => {
    const { rerender } = render(<GiftReveal theme="sunrise" note={null} noteStatus="loading" amountText="0.01 BOT" />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    rerender(<GiftReveal theme="sunrise" note="Late note" noteStatus="ok" amountText="0.01 BOT" />);
    expect(screen.getByText("Late note")).toBeTruthy();
  });

  it("the tappable box opens the gift too", () => {
    render(<GiftReveal theme="night-sky" note="Hi" noteStatus="ok" amountText="1 BOT" />);
    fireEvent.click(screen.getByRole("button", { name: /tap the gift box/i }));
    expect(screen.getByText("Hi")).toBeTruthy();
  });
});
