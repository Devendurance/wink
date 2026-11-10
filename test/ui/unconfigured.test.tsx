// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mainnet mode with no deployed vault: the unconfigured state must expose no write path.
vi.mock("@/lib/network", async () => {
  const actual = await vi.importActual<typeof import("@/lib/network")>("@/lib/network");
  const active = actual.buildActiveNetwork({ network: "mainnet" });
  return { ...actual, ACTIVE: active, txUrl: (h: string) => `${active.explorer}/tx/${h}`, addressUrl: (a: string) => `${active.explorer}/address/${a}` };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("wagmi", () => ({
  useConnection: () => ({ address: "0x2222222222222222222222222222222222222222", isConnected: true, chainId: 677 }),
  useBalance: () => ({ data: { value: 10n ** 18n } }),
  useSwitchChain: () => ({ mutate: vi.fn(), isPending: false }),
  useConnectors: () => [],
  useConnect: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useDisconnect: () => ({ mutate: vi.fn() }),
  usePublicClient: () => ({}),
  useWalletClient: () => ({ data: undefined }),
}));

import { CreateGift } from "@/components/CreateGift";
import { GiftPage } from "@/components/GiftView";
import { ACTIVE } from "@/lib/network";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

afterEach(() => cleanup());

describe("unconfigured mainnet", () => {
  it("has no vault and a mainnet chain", () => {
    expect(ACTIVE.chain.id).toBe(677);
    expect(ACTIVE.vault).toBeNull();
    expect(ACTIVE.configured).toBe(false);
  });

  it("creation is disabled with no funding control", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CreateGift />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Gift creation is not live on BOT Chain yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Fund and create gift/ })).toBeNull();
    expect(screen.queryByLabelText("Who is it for?")).toBeNull();
  });

  it("gift pages explain the vault is not deployed and offer no claim or reclaim", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <GiftPage giftId="0" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Gifts are not live here yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /claim|reclaim/i })).toBeNull();
  });
});
