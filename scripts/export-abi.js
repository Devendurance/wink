const fs = require("fs");
const path = require("path");

async function main() {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "WinkGiftVault.sol",
    "WinkGiftVault.json"
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact missing at ${artifactPath}. Run: npx hardhat compile`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const outDir = path.join(__dirname, "..", "abi");
  fs.mkdirSync(outDir, { recursive: true });
  const out = {
    contractName: artifact.contractName,
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  };
  fs.writeFileSync(path.join(outDir, "WinkGiftVault.json"), JSON.stringify(out, null, 2) + "\n");
  console.log("ABI artifact written to abi/WinkGiftVault.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
