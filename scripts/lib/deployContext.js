const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const guard = require("./deployGuard");

const ROOT = path.join(__dirname, "..", "..");
const DEPLOY_DIR = path.join(ROOT, "deployments");

function recordPath(network) {
  return path.join(DEPLOY_DIR, `${network}.json`);
}

function readRecord(network) {
  const file = recordPath(network);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeRecord(network, record) {
  fs.mkdirSync(DEPLOY_DIR, { recursive: true });
  fs.writeFileSync(recordPath(network), JSON.stringify(record, null, 2) + "\n");
}

function compilerInfo() {
  const c = hre.config.solidity.compilers[0];
  return { solc: c.version, optimizer: c.settings.optimizer, evmVersion: c.settings.evmVersion || "default" };
}

/** Confirm the RPC is the chain we expect using two independent reads. */
async function checkChain(network) {
  const net = await hre.ethers.provider.getNetwork();
  const raw = await hre.network.provider.send("eth_chainId");
  return guard.assertConsistentChainIds(network, net.chainId, raw);
}

/** First configured signer's address, or null when no key is configured. Never the key. */
async function signerAddress() {
  const signers = await hre.ethers.getSigners();
  return signers[0] ? { signer: signers[0], address: await signers[0].getAddress() } : null;
}

async function estimateDeploy(from) {
  const Factory = await hre.ethers.getContractFactory("WinkGiftVault");
  const tx = await Factory.getDeployTransaction();
  const [gas, fee] = await Promise.all([
    hre.ethers.provider.estimateGas({ ...tx, from }),
    hre.ethers.provider.getFeeData(),
  ]);
  const price = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
  return { gas, price, cost: gas * price };
}

module.exports = { ROOT, readRecord, writeRecord, recordPath, compilerInfo, checkChain, signerAddress, estimateDeploy, guard, hre };
