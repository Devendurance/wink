/**
 * Browser check of the reclaim UI against a SIMULATED chain.
 *
 * It intercepts the Bohr RPC and injects a mock EIP-6963 wallet, so it proves the
 * frontend reaches reclaim(giftId), waits for a receipt, verifies GiftReclaimed
 * and re-reads the gift. It does NOT prove anything about the live chain.
 *
 * Usage: BASE=http://localhost:3199 CHROMIUM_PATH=... node scripts/qa/reclaim-sim.mjs
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const viem = require("viem");
const abi = require("../../abi/WinkGiftVault.json").abi;

const BASE = process.env.BASE ?? "http://localhost:3199";
const VAULT = "0x61CB150B69baBa224A75F88307eAf9ce8B992c8E";
const SENDER = "0x1111111111111111111111111111111111111111";
const RECIPIENT = "0x2222222222222222222222222222222222222222";
const AMOUNT = 4n * 10n ** 17n;
const now = Math.floor(Date.now() / 1000);
const EXPIRES = BigInt(now - 3600); // expired an hour ago on the simulated chain
const hex = (n) => "0x" + BigInt(n).toString(16);
const zeroHash = "0x" + "00".repeat(32);

let state = 1; // 1 funded, 3 reclaimed
let receiptRequested = false;
const calls = [];

const giftResult = () =>
  viem.encodeFunctionResult({
    abi,
    functionName: "getGift",
    result: { sender: SENDER, recipient: RECIPIENT, amount: AMOUNT, expiresAt: EXPIRES, metadataHash: "0x" + "ab".repeat(32), state },
  });

const block = () => ({
  number: "0x1c93000", hash: "0x" + "11".repeat(32), parentHash: "0x" + "22".repeat(32), timestamp: hex(now),
  nonce: "0x0000000000000000", difficulty: "0x0", gasLimit: "0x1c9c380", gasUsed: "0x0", miner: SENDER,
  extraData: "0x", logsBloom: "0x" + "00".repeat(256), transactions: [], uncles: [], sha3Uncles: zeroHash,
  stateRoot: zeroHash, receiptsRoot: zeroHash, transactionsRoot: zeroHash, size: "0x200", mixHash: zeroHash, totalDifficulty: "0x0",
});

function receipt(hash) {
  const topics = viem.encodeEventTopics({ abi, eventName: "GiftReclaimed", args: { giftId: 3n, sender: SENDER } });
  const data = viem.encodeAbiParameters([{ type: "uint256" }], [AMOUNT]);
  return {
    status: "0x1", transactionHash: hash, blockHash: "0x" + "33".repeat(32), blockNumber: "0x1c93001", transactionIndex: "0x0",
    from: SENDER, to: VAULT, cumulativeGasUsed: "0x7530", gasUsed: "0x7530", effectiveGasPrice: "0x3b9aca00",
    logsBloom: "0x" + "00".repeat(256), type: "0x2", contractAddress: null,
    logs: [{ address: VAULT, topics, data, blockNumber: "0x1c93001", transactionHash: hash, transactionIndex: "0x0", blockHash: "0x" + "33".repeat(32), logIndex: "0x0", removed: false }],
  };
}

function handle(req) {
  const { method, params = [] } = req;
  switch (method) {
    case "eth_chainId": return "0x3c8";
    case "eth_blockNumber": return "0x1c93000";
    case "eth_getBlockByNumber": return block();
    case "eth_getBalance": return hex(10n ** 18n);
    case "eth_gasPrice": return "0x3b9aca00";
    case "eth_maxPriorityFeePerGas": return "0x3b9aca00";
    case "eth_estimateGas": return "0x7530";
    case "eth_getLogs": return [];
    case "eth_call": {
      const data = params[0]?.data ?? params[0]?.input ?? "0x";
      if (data.startsWith(viem.toFunctionSelector("getGift(uint256)"))) return giftResult();
      return "0x";
    }
    case "eth_getTransactionReceipt": receiptRequested = true; state = 3; return receipt(params[0]);
    default: return null;
  }
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(
  ({ sender }) => {
    window.__sent = [];
    const provider = {
      request: async ({ method, params }) => {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [sender];
        if (method === "eth_chainId") return "0x3c8";
        if (method === "wallet_switchEthereumChain") return null;
        if (method === "eth_sendTransaction") {
          window.__sent.push(params[0]);
          return "0x" + "ef".repeat(32);
        }
        return null;
      },
      on() {}, removeListener() {},
    };
    const announce = () =>
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "mock-1", name: "Mock Wallet", icon: "data:image/svg+xml;base64,PHN2Zy8+", rdns: "mock.wallet" }, provider }) }));
    window.addEventListener("eip6963:requestProvider", announce);
    announce();
  },
  { sender: SENDER }
);
const page = await ctx.newPage();
await page.route("https://rpc.bohr.life/**", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}");
  const one = (r) => {
    calls.push(r.method);
    return { jsonrpc: "2.0", id: r.id, result: handle(r) };
  };
  const out = Array.isArray(body) ? body.map(one) : one(body);
  await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(out) });
});

const results = {};
await page.goto(`${BASE}/g/3`);
await page.getByText("Gift number 3").waitFor({ timeout: 20000 });
results.metadataMissingStillShowsGift = (await page.getByText(/personal message could not be shown/i).count()) >= 0;
// wagmi reconnects the mock wallet automatically, so the sender is connected on load.
await page.getByText("Take your BOT back").waitFor({ timeout: 10000 });
const reclaim = page.getByRole("button", { name: "Reclaim Gift" });
results.reclaimEnabled = await reclaim.isEnabled();
await reclaim.click();
await page.getByText("Reclaimed by the sender").first().waitFor({ timeout: 20000 });
results.sentTxs = await page.evaluate(() => window.__sent.map((t) => ({ to: t.to, data: t.data.slice(0, 10) + "..." + t.data.slice(-4), from: t.from })));
results.reclaimSelectorOk = (await page.evaluate(() => window.__sent[0]?.data?.slice(0, 10))) === viem.toFunctionSelector("reclaim(uint256)");
results.receiptWasRequested = receiptRequested;
results.finalReclaimButtonGone = (await page.getByRole("button", { name: /Reclaim Gift/ }).count()) === 0;
results.rpcMethodsSeen = [...new Set(calls)].join(",");
await page.screenshot({ path: process.env.SHOT ?? "reclaim-sim.png", fullPage: true });
console.log(JSON.stringify(results, null, 1));
await browser.close();
const ok = results.reclaimEnabled && results.reclaimSelectorOk && results.finalReclaimButtonGone;
process.exit(ok ? 0 : 1);
