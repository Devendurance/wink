/**
 * Pure guard and record helpers for deployment scripts. No network access and
 * no secrets, so every rule here is unit tested.
 */

const EXPECTED_IDS = {
  botchainTestnet: 968,
  botchainMainnet: 677,
};

const EXPLORERS = {
  botchainTestnet: "https://scan.bohr.life",
  botchainMainnet: "https://scan.botchain.ai",
};

/** The exact phrase that must be set in WINK_CONFIRM_MAINNET_DEPLOY to deploy to mainnet. */
const MAINNET_ACK = "deploy-wink-vault-to-botchain-mainnet-677";

/** Networks where chain id and records are enforced. Anything else is a local dry run. */
function isProductionNetwork(network) {
  return Object.prototype.hasOwnProperty.call(EXPECTED_IDS, network);
}

function assertExpectedChain(network, chainId) {
  const expected = EXPECTED_IDS[network];
  if (expected === undefined) return;
  if (Number(chainId) !== expected) {
    throw new Error(
      `Chain ID mismatch on ${network}: RPC reports ${chainId}, expected ${expected}. No transaction was sent. Check the RPC URL.`
    );
  }
}

/** Two independent reads of the chain id must agree with each other and the expectation. */
function assertConsistentChainIds(network, providerChainId, rawChainIdHex) {
  const raw = Number(BigInt(rawChainIdHex));
  if (Number(providerChainId) !== raw) {
    throw new Error(`RPC returned inconsistent chain ids (${providerChainId} vs ${raw}). Refusing to continue.`);
  }
  assertExpectedChain(network, raw);
  return raw;
}

function requireMainnetAck(network, env) {
  if (network !== "botchainMainnet") return;
  if (env.WINK_CONFIRM_MAINNET_DEPLOY !== MAINNET_ACK) {
    throw new Error(
      "Mainnet deployment is not acknowledged. Mainnet deployment is irreversible. " +
        `To proceed deliberately, set WINK_CONFIRM_MAINNET_DEPLOY=${MAINNET_ACK} for this single command. No transaction was sent.`
    );
  }
}

/** A recorded deployment is never overwritten unless explicitly allowed. */
function assertNoOverwrite(existingRecord, env) {
  if (existingRecord && existingRecord.address && env.WINK_ALLOW_REDEPLOY !== "1") {
    throw new Error(
      `A deployment is already recorded at ${existingRecord.address}. Refusing to deploy again. ` +
        "Set WINK_ALLOW_REDEPLOY=1 only if you intend a brand new contract."
    );
  }
}

/** Safe description of a signer. Never includes key material. */
function describeSigner(address, balanceWei) {
  return { address, balanceWei: balanceWei.toString() };
}

function assertFunded(balanceWei, estimatedCostWei, bufferPercent = 25) {
  const needed = (BigInt(estimatedCostWei) * BigInt(100 + bufferPercent)) / 100n;
  if (BigInt(balanceWei) < needed) {
    throw new Error(
      `Signer balance ${balanceWei} wei is below the estimated deployment cost with a ${bufferPercent}% buffer (${needed} wei).`
    );
  }
  return needed;
}

function buildDeploymentRecord({ network, chainId, address, txHash, receipt, compiler, codeExists, now = new Date() }) {
  if (receipt.status !== 1 && receipt.status !== "success") {
    throw new Error("Deployment receipt did not report success.");
  }
  if (!codeExists) throw new Error("No contract code exists at the deployed address.");
  const explorer = EXPLORERS[network];
  return {
    network,
    chainId: Number(chainId),
    contract: "WinkGiftVault",
    address,
    deploymentTx: txHash,
    receiptStatus: "success",
    block: Number(receipt.blockNumber),
    gasUsed: receipt.gasUsed !== undefined ? receipt.gasUsed.toString() : undefined,
    compiler,
    codeExists: true,
    deployedAt: now.toISOString(),
    explorer: explorer ? `${explorer}/address/${address}` : undefined,
    verified: false,
  };
}

/** @param {object} record @param {{verified: boolean, url?: string, error?: unknown, now?: Date}} opts */
function markVerified(record, { verified, url, error, now = new Date() }) {
  const next = { ...record, verified: !!verified };
  if (verified) {
    next.verifiedAt = now.toISOString();
    next.verificationUrl = url;
    delete next.verificationError;
  } else if (error) {
    next.verificationError = String(error).slice(0, 300);
  }
  return next;
}

/** Source features that would introduce admin custody, upgrades or proxies. */
const FORBIDDEN_SOURCE_PATTERNS = [
  /\bOwnable\b/,
  /\bonlyOwner\b/,
  /\bdelegatecall\b/i,
  /\bselfdestruct\b/,
  /\bUUPSUpgradeable\b/,
  /\bTransparentUpgradeableProxy\b/,
  /\bAccessControl\b/,
  /\bPausable\b/,
];

function findForbiddenSourceFeatures(source) {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return FORBIDDEN_SOURCE_PATTERNS.filter((re) => re.test(stripped)).map((re) => re.source);
}

module.exports = {
  EXPECTED_IDS,
  EXPLORERS,
  MAINNET_ACK,
  isProductionNetwork,
  assertExpectedChain,
  assertConsistentChainIds,
  requireMainnetAck,
  assertNoOverwrite,
  describeSigner,
  assertFunded,
  buildDeploymentRecord,
  markVerified,
  findForbiddenSourceFeatures,
};
