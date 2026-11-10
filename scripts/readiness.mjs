/**
 * Read-only deployment readiness report. Sends no transactions and prints no secrets.
 *
 *   npm run readiness                         (checks the local .env and .next build)
 *   BASE=https://usewink.vercel.app npm run readiness   (also queries the live health endpoint)
 *
 * It reports configuration presence as booleans, never values, except public
 * contract addresses. It scans the built client bundle for leaked secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
try {
  require("dotenv").config();
} catch {
  // dotenv is optional here.
}

const rows = [];
const add = (level, name, detail) => rows.push({ level, name, detail });
const has = (k) => !!(process.env[k] && process.env[k].trim());

// 1. Public variables must be public only.
const publicVars = Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_"));
const suspicious = publicVars.filter((k) => /KEY|SECRET|PASSWORD|DATABASE|TOKEN|MNEMONIC/i.test(k) && !/^NEXT_PUBLIC_VAULT_/.test(k));
add(suspicious.length ? "fail" : "pass", "NEXT_PUBLIC_* contains no secret-looking names", suspicious.length ? suspicious.join(", ") : `${publicVars.length} public variables checked`);

// 2. Server-only secrets exist but are not exposed as public variables.
add(has("DATABASE_URL") ? "pass" : "warn", "DATABASE_URL set (server-only)", has("DATABASE_URL") ? "present" : "missing: metadata API will return 503");
add(has("PRIVATE_KEY") ? "info" : "info", "PRIVATE_KEY (deployer, local only)", has("PRIVATE_KEY") ? "present locally. It must NOT be set in Vercel." : "not set locally");

// 3. Network selection and per-network configuration.
const net = (process.env.NEXT_PUBLIC_WINK_NETWORK || "testnet").trim().toLowerCase();
add(net === "testnet" || net === "mainnet" ? "pass" : "fail", "NEXT_PUBLIC_WINK_NETWORK", `"${net}"`);
const addr = /^0x[0-9a-fA-F]{40}$/;
const block = /^[1-9][0-9]{0,15}$/;
const mainAddr = process.env.NEXT_PUBLIC_VAULT_ADDRESS_MAINNET?.trim();
const mainBlock = process.env.NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_MAINNET?.trim();
const mainReady = !!mainAddr && addr.test(mainAddr) && !!mainBlock && block.test(mainBlock);
add(mainReady ? "pass" : net === "mainnet" ? "fail" : "info", "Mainnet vault configured (address and deploy block)", mainReady ? `${mainAddr} @ block ${mainBlock}` : "not configured (expected until mainnet deployment)");
if (mainAddr && !addr.test(mainAddr)) add("fail", "NEXT_PUBLIC_VAULT_ADDRESS_MAINNET format", "not a valid 0x address");
if (mainBlock && !block.test(mainBlock)) add("fail", "NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_MAINNET format", "not a positive integer");
const testAddr = process.env.NEXT_PUBLIC_VAULT_ADDRESS_TESTNET?.trim();
if (testAddr && mainAddr && testAddr.toLowerCase() === mainAddr.toLowerCase()) add("fail", "Testnet and mainnet vault addresses differ", "they are identical, which should be impossible");
if (net === "mainnet" && !mainReady) add("fail", "Mainnet mode is active without a configured mainnet vault", "writes are disabled by the app, but fix the environment");

// 4. Built client bundle must not contain secret values.
const staticDir = path.join(process.cwd(), ".next", "static");
if (fs.existsSync(staticDir)) {
  const secrets = ["PRIVATE_KEY", "DATABASE_URL", "BOTCHAIN_MAINNET_API_KEY", "BOTCHAIN_TESTNET_API_KEY"].map((k) => [k, process.env[k]?.trim()]).filter(([, v]) => v && v.length >= 12);
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|css|html|json|map)$/.test(e.name)) files.push(p);
    }
  };
  walk(staticDir);
  const leaked = new Set();
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    for (const [k, v] of secrets) if (text.includes(v)) leaked.add(k);
  }
  add(leaked.size ? "fail" : "pass", "Client bundle contains no secret values", leaked.size ? `LEAKED: ${[...leaked].join(", ")}` : `${files.length} files scanned for ${secrets.length} secrets`);
} else {
  add("info", "Client bundle scan", "no .next build found (run npm run build first)");
}

// 5. Live health endpoint, if requested.
const base = process.env.BASE;
if (base) {
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/health?deep=1`, { signal: AbortSignal.timeout(15000) });
    const h = await res.json();
    const text = JSON.stringify(h);
    add(/postgres(ql)?:\/\/|PRIVATE_KEY|0x[0-9a-f]{64}/i.test(text) ? "fail" : "pass", "Health response exposes no secrets", "checked connection strings and key-like values");
    add(h.metadataStore === "configured" ? "pass" : "fail", "Live metadata store", h.metadataStore);
    add("info", "Live active network", String(h.activeNetwork));
    for (const k of ["testnet", "mainnet"]) {
      const c = h.chains?.[k];
      if (!c) continue;
      add(c.launchReady ? "pass" : k === h.activeNetwork ? "fail" : "info", `Live ${k} vault`, c.configured ? `${c.vaultAddress} @ ${c.deployBlock}, code on chain: ${c.codeOnChain}` : `not configured: ${c.missing.join("; ")}`);
    }
  } catch (err) {
    add("warn", "Live health endpoint", `unreachable: ${String(err.message).slice(0, 80)}`);
  }
}

const w = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) console.log(`${r.level.toUpperCase().padEnd(5)} ${r.name.padEnd(w)}  ${r.detail}`);
const failed = rows.filter((r) => r.level === "fail").length;
console.log(`\n${failed ? "NOT READY" : "OK"}: ${failed} failed. No transactions were sent.`);
process.exit(failed ? 1 : 0);
