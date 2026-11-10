import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { botMainnet, botTestnet } from "./network";

/**
 * Injected wallets only (MetaMask, Rabby, Coinbase Wallet extension, OKX and any
 * other EIP-6963 wallet, plus mobile in-app wallet browsers). No WalletConnect
 * project exists, so none is configured.
 */
export const wagmiConfig = createConfig({
  chains: [botTestnet, botMainnet],
  connectors: [injected()],
  multiInjectedProviderDiscovery: true,
  ssr: true,
  transports: {
    [botTestnet.id]: http(botTestnet.rpcUrls.default.http[0]),
    [botMainnet.id]: http(botMainnet.rpcUrls.default.http[0]),
  },
});
