/**
 * Responsive regression check. Needs a running server (npm run build && npm start).
 *
 * Usage: BASE=http://localhost:3000 CHROMIUM_PATH=... SHOOT_DIR=./shots node scripts/qa/responsive-check.mjs
 * Asserts, per width and route: no document-level horizontal scroll, the right
 * header controls for the breakpoint, a working menu on mobile, a centred hero,
 * and 16px minimum input text so iOS never auto-zooms.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const BASE = process.env.BASE ?? "http://localhost:3000";
const WIDTHS = (process.env.WIDTHS ?? "320,360,375,390,414,430,768,1024,1440").split(",").map(Number);
const ROUTES = (process.env.ROUTES ?? "/,/create,/g/0,/g/1,/g/2,/g/3,/sent").split(",");
const SHOOT_DIR = process.env.SHOOT_DIR;
if (SHOOT_DIR) fs.mkdirSync(SHOOT_DIR, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const failures = [];
const fail = (w, r, msg) => failures.push(`${w}px ${r}: ${msg}`);

for (const w of WIDTHS) {
  const mobile = w < 1024;
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, isMobile: w < 768, hasTouch: w < 768 });
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    await page.goto(BASE + r);
    await page.waitForTimeout(r.startsWith("/g/") ? 3500 : 1200);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const visible = (el) => {
        const cs = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        return cs.display !== "none" && cs.visibility !== "hidden" && b.width > 0 && b.height > 0;
      };
      const nav = document.querySelector("header nav");
      const kids = nav ? [...nav.children] : [];
      const burger = nav?.querySelector("button[aria-controls='mobile-menu']");
      const links = nav ? [...nav.querySelectorAll("a, button")].filter(visible).map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim()) : [];
      const navBox = nav?.getBoundingClientRect();
      const heading = document.querySelector("h1");
      const hb = heading?.getBoundingClientRect();
      const inputs = [...document.querySelectorAll("input, textarea")].filter(visible).map((e) => parseFloat(getComputedStyle(e).fontSize));
      return {
        scrollW: de.scrollWidth, clientW: de.clientWidth, kids: kids.length,
        burgerVisible: !!burger && visible(burger), links, navRight: navBox?.right ?? 0,
        headingCentre: hb ? hb.left + hb.width / 2 : null, minInput: inputs.length ? Math.min(...inputs) : null,
      };
    });
    if (m.scrollW > m.clientW) fail(w, r, `document scrolls horizontally (${m.scrollW} > ${m.clientW})`);
    if (m.navRight > m.clientW + 1) fail(w, r, "header overflows the viewport");
    if (mobile) {
      if (!m.burgerVisible) fail(w, r, "hamburger missing below 1024");
      if (m.links.some((t) => /connect wallet|create a gift|testnet|sent gifts/i.test(t))) fail(w, r, `extra header controls on mobile: ${m.links.join("|")}`);
    } else {
      if (m.burgerVisible) fail(w, r, "hamburger visible on desktop");
      if (!m.links.some((t) => /create a gift/i.test(t))) fail(w, r, "desktop nav lacks Create a gift");
    }
    if (r === "/" && m.headingCentre !== null && Math.abs(m.headingCentre - m.clientW / 2) > 3) fail(w, r, `hero heading off centre (${Math.round(m.headingCentre)} vs ${m.clientW / 2})`);
    if (r === "/create" && m.minInput !== null && m.minInput < 16) fail(w, r, `input font ${m.minInput}px would trigger iOS zoom`);
    if (SHOOT_DIR) await page.screenshot({ path: `${SHOOT_DIR}/${w}${r.replace(/\//g, "_") || "_"}.png` });
  }
  if (mobile) {
    await page.goto(BASE + "/");
    await page.waitForTimeout(800);
    const burger = page.getByRole("button", { name: /open menu/i });
    await burger.click();
    const menu = page.getByRole("region", { name: "Menu" });
    if (!(await menu.isVisible())) fail(w, "menu", "menu did not open");
    for (const t of ["Create a gift", "How it works", "Occasions", "Safety", "Sent gifts"]) {
      if ((await menu.getByRole("link", { name: t }).count()) === 0) fail(w, "menu", `missing link ${t}`);
    }
    if ((await menu.getByText(/testnet/i).count()) === 0) fail(w, "menu", "missing network status");
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    if (!sw) fail(w, "menu", "menu open causes horizontal scroll");
    if (SHOOT_DIR) await page.screenshot({ path: `${SHOOT_DIR}/${w}_menu.png` });
    await page.keyboard.press("Escape");
    if (await menu.isVisible().catch(() => false)) fail(w, "menu", "Escape did not close the menu");
    await burger.click();
    await menu.getByRole("link", { name: "Sent gifts" }).click();
    await page.waitForURL(/\/sent/);
    if (await page.getByRole("region", { name: "Menu" }).isVisible().catch(() => false)) fail(w, "menu", "menu stayed open after navigation");
  }
  await ctx.close();
}
await browser.close();
if (failures.length) {
  console.log(`FAILED (${failures.length})\n` + failures.join("\n"));
  process.exit(1);
}
console.log(`OK: ${WIDTHS.length} widths x ${ROUTES.length} routes passed`);
