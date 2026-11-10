/**
 * Verify the recorded deployment's source on the explorer and update its record.
 *
 *   npx hardhat run scripts/verify.js --network botchainMainnet
 */
const { hre, guard, readRecord, writeRecord } = require("./lib/deployContext");

async function main() {
  const network = hre.network.name;
  const record = readRecord(network);
  if (!record || !record.address) throw new Error(`No deployment record for ${network}. Deploy first.`);
  const code = await hre.ethers.provider.getCode(record.address);
  if (code === "0x") throw new Error(`No code at ${record.address} on ${network}. Refusing to verify.`);
  const chain = hre.config.etherscan.customChains.find((c) => c.network === network);
  const url = `${chain.urls.browserURL}/address/${record.address}#code`;

  try {
    await hre.run("verify:verify", { address: record.address, constructorArguments: [] });
  } catch (err) {
    if (!/already verified/i.test(String(err.message))) {
      writeRecord(network, guard.markVerified(record, { verified: false, error: err.message }));
      throw new Error(`Verification failed: ${String(err.message).slice(0, 300)}`);
    }
  }
  writeRecord(network, guard.markVerified(record, { verified: true, url }));
  console.log(`Verified. Record updated. ${url}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
