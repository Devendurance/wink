/**
 * Read-only deployment preflight. Sends no transaction and needs no funded signer.
 *
 *   npx hardhat run scripts/preflight.js --network botchainMainnet
 *
 * Signer problems are warnings by default. Set WINK_PREFLIGHT_STRICT=1 to make a
 * missing or underfunded signer a failure (use that right before deploying).
 */
const fs = require("fs");
const path = require("path");
const { hre, guard, ROOT, readRecord, compilerInfo, checkChain, signerAddress, estimateDeploy } = require("./lib/deployContext");

const results = [];
const add = (level, name, detail) => results.push({ level, name, detail });

async function reachable(url) {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  const network = hre.network.name;
  const strict = process.env.WINK_PREFLIGHT_STRICT === "1";
  const soft = strict ? "fail" : "warn";

  // Chain identity.
  try {
    const id = await checkChain(network);
    add("pass", "RPC chain id", `${id} matches ${network}`);
  } catch (err) {
    add("fail", "RPC chain id", err.message);
  }

  // RPC health.
  try {
    const block = await hre.ethers.provider.getBlock("latest");
    const ageSec = Math.floor(Date.now() / 1000) - block.timestamp;
    add(ageSec < 180 ? "pass" : "warn", "RPC head", `block ${block.number}, ${ageSec}s old`);
  } catch (err) {
    add("fail", "RPC head", `RPC did not answer: ${String(err.message).slice(0, 120)}`);
  }

  // Source safety: no owner, proxy, upgrade or pause powers.
  const src = fs.readFileSync(path.join(ROOT, "contracts", "WinkGiftVault.sol"), "utf8");
  const bad = guard.findForbiddenSourceFeatures(src);
  add(bad.length ? "fail" : "pass", "No admin custody or upgrades", bad.length ? `found: ${bad.join(", ")}` : "no owner, proxy, delegatecall, pause or selfdestruct");

  // ABI artifact in sync with a fresh compile.
  try {
    await hre.run("compile", { quiet: true });
    const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts", "contracts", "WinkGiftVault.sol", "WinkGiftVault.json"), "utf8"));
    const exported = JSON.parse(fs.readFileSync(path.join(ROOT, "abi", "WinkGiftVault.json"), "utf8"));
    const same = JSON.stringify(artifact.abi) === JSON.stringify(exported.abi);
    add(same ? "pass" : "fail", "abi/WinkGiftVault.json matches compiled contract", same ? "in sync" : "run npm run export-abi and commit");
  } catch (err) {
    add("fail", "Compile and ABI sync", String(err.message).slice(0, 160));
  }

  const c = compilerInfo();
  add("info", "Compiler", `solc ${c.solc}, optimizer ${JSON.stringify(c.optimizer)}`);

  // Existing record.
  const record = readRecord(network);
  if (record && record.address) {
    add(network === "botchainMainnet" ? "warn" : "info", "Existing deployment record", `${record.address} (deploy will refuse unless WINK_ALLOW_REDEPLOY=1)`);
    try {
      const code = await hre.ethers.provider.getCode(record.address);
      add(code !== "0x" ? "pass" : "fail", "Recorded contract has code on chain", code !== "0x" ? "yes" : "no code at recorded address");
    } catch {
      add("warn", "Recorded contract code check", "RPC error");
    }
  } else {
    add("info", "Existing deployment record", "none");
  }

  // Signer and funds (warnings unless strict).
  const found = await signerAddress();
  if (!found) {
    add(soft, "Deployment signer", "PRIVATE_KEY is not set. Fine for preflight, required to deploy.");
  } else {
    try {
      const balance = await hre.ethers.provider.getBalance(found.address);
      add("pass", "Deployment signer", `${found.address} (address only shown)`);
      try {
        const est = await estimateDeploy(found.address);
        try {
          guard.assertFunded(balance, est.cost);
          add("pass", "Signer funded", `${hre.ethers.formatEther(balance)} BOT, estimated cost ${hre.ethers.formatEther(est.cost)} BOT`);
        } catch (err) {
          add(soft, "Signer funded", err.message);
        }
      } catch (err) {
        add("warn", "Deployment gas estimate", String(err.message).slice(0, 140));
      }
    } catch (err) {
      add("warn", "Signer balance", String(err.message).slice(0, 120));
    }
  }

  // Mainnet acknowledgment (informational here).
  if (network === "botchainMainnet") {
    add(process.env.WINK_CONFIRM_MAINNET_DEPLOY === guard.MAINNET_ACK ? "info" : "pass", "Mainnet acknowledgment", process.env.WINK_CONFIRM_MAINNET_DEPLOY === guard.MAINNET_ACK ? "SET in this shell, deploy would proceed" : "not set, deploy will refuse (expected until you deliberately set it)");
  }

  // Explorer verification configuration.
  const chain = hre.config.etherscan.customChains.find((x) => x.network === network);
  if (chain) {
    const key = hre.config.etherscan.apiKey[network];
    add(chain.chainId === guard.EXPECTED_IDS[network] ? "pass" : "fail", "Explorer config chain id", `${chain.chainId}`);
    add("info", "Explorer verification API", chain.urls.apiURL);
    add(key && key !== "NO_KEY" ? "pass" : "warn", "Explorer API key", key && key !== "NO_KEY" ? "configured" : "not set (some explorers need one)");
    add((await reachable(chain.urls.browserURL)) ? "pass" : "warn", "Explorer reachable", chain.urls.browserURL);
  }

  const width = Math.max(...results.map((r) => r.name.length));
  for (const r of results) console.log(`${r.level.toUpperCase().padEnd(5)} ${r.name.padEnd(width)}  ${r.detail}`);
  const failed = results.filter((r) => r.level === "fail").length;
  const warned = results.filter((r) => r.level === "warn").length;
  console.log(`\n${failed ? "NOT READY" : "READY"}: ${failed} failed, ${warned} warnings. No transaction was sent.`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
