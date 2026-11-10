/**
 * Deploy WinkGiftVault. Plain deployment: no proxy, no owner, no upgrade path.
 *
 * Order matters. Everything that can refuse runs BEFORE any transaction:
 *   1. chain id (two independent reads) equals the network's expected id
 *   2. mainnet acknowledgment phrase is present
 *   3. a signer exists (address only is ever printed) and is funded
 *   4. no existing record would be overwritten
 * Then deploy, wait for a successful receipt, confirm code exists, record it.
 *
 *   npx hardhat run scripts/deploy.js --network botchainTestnet
 *   WINK_CONFIRM_MAINNET_DEPLOY=<phrase> npx hardhat run scripts/deploy.js --network botchainMainnet
 */
const { hre, guard, readRecord, writeRecord, compilerInfo, checkChain, signerAddress, estimateDeploy } = require("./lib/deployContext");

async function main() {
  const network = hre.network.name;
  const production = guard.isProductionNetwork(network);
  const chainId = await checkChain(network);
  console.log(`Network ${network}, chain id ${chainId} confirmed.`);

  guard.requireMainnetAck(network, process.env);

  const found = await signerAddress();
  if (!found) throw new Error("No signer configured. Set PRIVATE_KEY in .env (never commit it). No transaction was sent.");
  const { signer, address: from } = found;
  const balance = await hre.ethers.provider.getBalance(from);
  console.log(`Signer ${from}, balance ${hre.ethers.formatEther(balance)} BOT.`);

  if (production) guard.assertNoOverwrite(readRecord(network), process.env);

  const est = await estimateDeploy(from);
  guard.assertFunded(balance, est.cost);
  console.log(`Estimated deployment cost ${hre.ethers.formatEther(est.cost)} BOT. Funded.`);

  const Factory = await hre.ethers.getContractFactory("WinkGiftVault", signer);
  const vault = await Factory.deploy();
  const tx = vault.deploymentTransaction();
  console.log(`Deployment transaction sent: ${tx.hash}`);
  const receipt = await tx.wait(network === "botchainMainnet" ? 2 : 1);
  if (!receipt || receipt.status !== 1) throw new Error(`Deployment transaction ${tx.hash} did not succeed.`);

  const address = await vault.getAddress();
  const code = await hre.ethers.provider.getCode(address);
  const record = guard.buildDeploymentRecord({
    network,
    chainId,
    address,
    txHash: tx.hash,
    receipt,
    compiler: compilerInfo(),
    codeExists: code !== "0x",
  });
  console.log(`WinkGiftVault deployed at ${address} in block ${record.block}.`);

  if (production) {
    writeRecord(network, record);
    console.log(`Deployment record written to deployments/${network}.json`);
  } else {
    console.log("Local dry run, no record written:", JSON.stringify(record));
  }

  if (production) {
    const publicNet = network === "botchainMainnet" ? "MAINNET" : "TESTNET";
    console.log("\nNext steps:");
    console.log("  1. npm run export-abi");
    console.log(`  2. npm run verify:${network === "botchainMainnet" ? "mainnet" : "testnet"}`);
    console.log(`  3. Set in Vercel: NEXT_PUBLIC_VAULT_ADDRESS_${publicNet}=${address}`);
    console.log(`                    NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_${publicNet}=${record.block}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
