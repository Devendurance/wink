# Wink — native-BOT gifting DApp on BOT Chain

Independent gift product. Sender funds native BOT into `WinkGiftVault`, the
designated recipient claims before expiry, otherwise the sender reclaims.
This repo is backend-first in SESSION A: contract plus tests and chain config.
No frontend wallet integration and no mainnet deployment in this session.

## Chains (verified 2026-11-10 via eth_chainId)

| Environment | Chain ID | RPC | Explorer |
|---|---|---|---|
| Bohr testnet | 968 (`0x3c8`) | https://rpc.bohr.life | https://scan.bohr.life |
| BOT Chain mainnet | 677 (`0x2a5`) | https://rpc.botchain.ai | https://scan.botchain.ai |

Testnet faucet: https://faucet.botchain.ai. Recipients pay their own claim gas.

## Contract

- `contracts/WinkGiftVault.sol`: `createGift(recipient, expiresAt, metadataHash)`
  payable, `claim(giftId)`, `reclaim(giftId)`, `getGift(giftId)`, events
  `GiftCreated` / `GiftClaimed` / `GiftReclaimed`.
- Rules: amount > 0, recipient set and not the sender, expiry within
  now+1h to now+30d. Claim only by recipient before expiry, reclaim only by
  sender at/after expiry. Checks-effects-interactions, `nonReentrant`,
  checked low-level calls. No admin drain, no proxy, no fee.
- Mocks: `contracts/test/Mocks.sol` (reverting + reentrant recipients).
- Committed ABI: `abi/WinkGiftVault.json` (refresh with `npm run export-abi`).

## Backend quickstart

```bash
npm install
cp .env.example .env        # fill PRIVATE_KEY only when deploying
npx hardhat compile
npx hardhat test            # or: npm run test:contracts
node scripts/export-abi.js  # refresh abi/WinkGiftVault.json
```

Deploy to testnet only when ready (checks RPC chain ID before sending):

```bash
npm run deploy:testnet
```

Do not deploy to mainnet in SESSION A. Mainnet path exists
(`npm run deploy:mainnet`) for a later verified release session only.

## Tests

`test/WinkGiftVault.test.js` — 17 cases: happy-path create/claim/reclaim,
zero amount/address, self-gift, expiry window, unknown IDs, wrong caller,
early/late boundaries incl. exact `expiresAt - 1` / `expiresAt` edges,
exact payout math, double-withdrawal paths, reverting recipient, reentrancy,
direct-transfer rejection, multi-gift isolation, balance conservation,
seeded fuzz over amounts/expiries/hashes, and event values.

## Frontend scaffold

Next.js app lives in `src/`. Wallet integration is out of scope for SESSION A.

## Docs

Playbook: `WINK_5_HOUR_BACKEND_FIRST_PLAYBOOK.md`. Product context: `docs/`.
