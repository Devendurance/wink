const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const EXPECTED_IDS = {
  botchainTestnet: 968,
  botchainMainnet: 677,
};

async function main() {
  const network = hre.network.name;
  const { chainId } = await hre.ethers.provider.getNetwork();
  console.log(`Deploying WinkGiftVault to ${network} (chainId ${chainId})...`);

  if (EXPECTED_IDS[network] && Number(chainId) !== EXPECTED_IDS[network]) {
    throw new Error(
      `Chain ID mismatch on ${network}: got ${chainId}, expected ${EXPECTED_IDS[network]}. Check RPC before sending transactions.`
    );
  }

  const Factory = await hre.ethers.getContractFactory("WinkGiftVault");
  const vault = await Factory.deploy();
  await vault.waitForDeployment();
  const address = await vault.getAddress();
  const block = await hre.ethers.provider.getBlockNumber();

  console.log(`WinkGiftVault deployed at ${address} (block ${block})`);

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        network,
        chainId: Number(chainId),
        address,
        block,
        contract: "WinkGiftVault",
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Deployment record written to deployments/${network}.json`);
  console.log("Next: npx hardhat run scripts/export-abi.js");
  console.log(`Verify: npx hardhat verify --network ${network} ${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
