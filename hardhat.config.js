require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const TESTNET_RPC = process.env.BOTCHAIN_TESTNET_RPC || "https://rpc.bohr.life";
const MAINNET_RPC = process.env.BOTCHAIN_MAINNET_RPC || "https://rpc.botchain.ai";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TESTNET_KEY = process.env.BOTCHAIN_TESTNET_API_KEY || "NO_KEY";
const MAINNET_KEY = process.env.BOTCHAIN_MAINNET_API_KEY || "NO_KEY";

const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    botchainTestnet: {
      url: TESTNET_RPC,
      chainId: 968,
      accounts,
    },
    botchainMainnet: {
      url: MAINNET_RPC,
      chainId: 677,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      botchainTestnet: TESTNET_KEY,
      botchainMainnet: MAINNET_KEY,
    },
    customChains: [
      {
        network: "botchainTestnet",
        chainId: 968,
        urls: {
          apiURL: process.env.BOHR_SCAN_API_URL || "https://scan.bohr.life/api",
          browserURL: "https://scan.bohr.life",
        },
      },
      {
        network: "botchainMainnet",
        chainId: 677,
        urls: {
          apiURL: process.env.BOTCHAIN_SCAN_API_URL || "https://scan.botchain.ai/api",
          browserURL: "https://scan.botchain.ai",
        },
      },
    ],
  },
};
