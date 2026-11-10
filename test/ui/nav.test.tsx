// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const wallet = { address: undefined as string | undefined, isConnected: false, chainId: 968 };
const disconnect = vi.fn();
const switchChain = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, onClick, ...rest }: { href: string; children: React.ReactNode; onClick?: () => void }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));
vi.mock("wagmi", () => ({
  useConnection: () => wallet,
  useBalance: () => ({ data: { value: 10n ** 18n } }),
  useSwitchChain: () => ({ mutate: switchChain, isPending: false }),
  useConnectors: () => [],
  useConnect: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useDisconnect: () => ({ mutate: disconnect }),
}));

import { SiteNav } from "@/components/SiteNav";

beforeEach(() => {
  wallet.address = undefined;
  wallet.isConnected = false;
  wallet.chainId = 968;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});
afterEach(() => cleanup());

const toggle = () => screen.getByRole("button", { name: /open menu|close menu/i });

describe("mobile navigation structure", () => {
  it("keeps only the wordmark and hamburger visible below lg, with everything else in desktop-only wrappers", () => {
    const { container } = render(<SiteNav />);
    const nav = container.querySelector("nav")!;
    // The persistent children of the nav row are: wordmark group, desktop group, hamburger.
    const [brand, desktop, burger] = Array.from(nav.children) as HTMLElement[];
    expect(within(brand).getByText("Wink")).toBeTruthy();
    expect(desktop.className).toMatch(/\bhidden\b/);
    expect(desktop.className).toMatch(/\blg:flex\b/);
    expect(burger.tagName).toBe("BUTTON");
    expect(burger.className).toMatch(/\blg:hidden\b/);
    // Regression: an inline display style would override the responsive utilities.
    expect(burger.style.display).toBe("");
    expect(desktop.style.display).toBe("");
    // The network pill beside the wordmark is desktop only.
    expect((brand.querySelector(".hidden") as HTMLElement).className).toMatch(/lg:block/);
    // The Create CTA button inside the header never carries a hide utility itself.
    const cta = within(desktop).getByRole("link", { name: "Create a gift" });
    expect(cta.className).not.toMatch(/\bhidden\b/);
  });

  it("opens and closes the menu with correct aria state", () => {
    render(<SiteNav />);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("region", { name: "Menu" })).toBeNull();
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().getAttribute("aria-controls")).toBe("mobile-menu");
    const menu = screen.getByRole("region", { name: "Menu" });
    expect(within(menu).getByText("Testnet")).toBeTruthy();
    expect(within(menu).getByText("No wallet found in this browser")).toBeTruthy();
    for (const label of ["Create a gift", "How it works", "Occasions", "Safety", "Sent gifts"]) {
      expect(within(menu).getByRole("link", { name: label })).toBeTruthy();
    }
    fireEvent.click(toggle());
    expect(screen.queryByRole("region", { name: "Menu" })).toBeNull();
  });

  it("moves focus into the menu, closes on Escape and returns focus to the toggle", () => {
    render(<SiteNav />);
    fireEvent.click(toggle());
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Menu" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Menu" })).toBeNull();
    expect(document.activeElement).toBe(toggle());
  });

  it("closes on an outside click but not on a click inside the menu", () => {
    render(<SiteNav />);
    fireEvent.click(toggle());
    fireEvent.pointerDown(screen.getByRole("region", { name: "Menu" }));
    expect(screen.getByRole("region", { name: "Menu" })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("region", { name: "Menu" })).toBeNull();
  });

  it("closes after navigating through a menu link", () => {
    render(<SiteNav />);
    fireEvent.click(toggle());
    fireEvent.click(within(screen.getByRole("region", { name: "Menu" })).getByRole("link", { name: "Sent gifts" }));
    expect(screen.queryByRole("region", { name: "Menu" })).toBeNull();
  });

  it("exposes working wallet controls inside the menu when connected", () => {
    wallet.address = "0x374A000000000000000000000000000000002EF3";
    wallet.isConnected = true;
    render(<SiteNav />);
    fireEvent.click(toggle());
    const menu = screen.getByRole("region", { name: "Menu" });
    expect(within(menu).getByText(wallet.address)).toBeTruthy();
    fireEvent.click(within(menu).getByRole("button", { name: "Disconnect" }));
    expect(disconnect).toHaveBeenCalled();
  });

  it("offers a network switch inside the menu on the wrong chain", () => {
    wallet.address = "0x374A000000000000000000000000000000002EF3";
    wallet.isConnected = true;
    wallet.chainId = 1;
    render(<SiteNav />);
    fireEvent.click(toggle());
    fireEvent.click(within(screen.getByRole("region", { name: "Menu" })).getByRole("button", { name: /Switch to BOT Chain Testnet/ }));
    expect(switchChain).toHaveBeenCalledWith({ chainId: 968 });
    // The global wrong-network banner also shows.
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
