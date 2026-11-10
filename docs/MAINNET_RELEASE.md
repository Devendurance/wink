# Wink mainnet release runbook

Wink runs today on BOT Chain testnet (chain 968). This runbook moves it to BOT Chain mainnet (chain 677). Everything the code can prepare is already prepared. What remains is funding, one irreversible deployment, configuration and real acceptance tests.

Read this first:

- A contract deployment is irreversible. There is no proxy, no owner and no upgrade path, by design. A bad deployment cannot be patched.
- A Vercel rollback changes the website only. It does not undo blockchain transactions and it does not move funds.
- Never promise anyone that funds can be recovered from a broken contract. The only recovery paths are the contract's own rules: the recipient claims before expiry, or the original sender reclaims after expiry.
- The live site stays on testnet until every step in section C is done.

## A. Prerequisites

Check each box before deploying.

- [ ] Mainnet BOT has arrived in the deployer wallet. The preflight estimate on 2026-11-10 was about 0.0135 BOT of gas for the deployment, and the script requires a 25 percent buffer (about 0.017 BOT). Fund more than that, because acceptance tests also spend gas and the gifts themselves.
- [ ] The funded wallet is the intended deployer. `npm run preflight:mainnet` prints its address (address only, never the key). Confirm it is the wallet you control.
- [ ] `PRIVATE_KEY` exists only in your local `.env`. It is never set in Vercel and never committed.
- [ ] RPC health for chain 677: preflight reports "RPC chain id 677 matches" and a fresh head block.
- [ ] Production domain is https://usewink.vercel.app (or the final domain) and loads.
- [ ] Neon connectivity: `GET /api/health` shows `"metadataStore":"configured"`. The `rate_limits` table exists (migration `0001_minor_electro`, applied with `npm run db:migrate`).
- [ ] The commit to ship is verified: `npm run test:contracts`, `npm run test:api`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass on that commit, and it is pushed to `main`.

## B. Deployment commands

Run from the repository root with the local `.env` containing `PRIVATE_KEY`.

1. Preflight. Read-only. Sends nothing.

   ```bash
   npm run preflight:mainnet
   ```

   Immediately before deploying, make signer problems hard failures:

   ```bash
   WINK_PREFLIGHT_STRICT=1 npm run preflight:mainnet
   ```

   Expected: `READY: 0 failed`. It checks chain id 677 from two independent reads, RPC freshness, that the source has no owner, proxy, pause or selfdestruct, that `abi/WinkGiftVault.json` matches a fresh compile, the signer and its funding, and the explorer configuration.

2. Deploy. This is the irreversible step. The script refuses unless you deliberately set the acknowledgment for this one command.

   ```bash
   WINK_CONFIRM_MAINNET_DEPLOY=deploy-wink-vault-to-botchain-mainnet-677 npx hardhat run scripts/deploy.js --network botchainMainnet
   ```

   Before any transaction it re-checks the chain id (677), the acknowledgment, the signer, its balance against the estimate, and that no `deployments/botchainMainnet.json` already exists. After the transaction it waits for 2 confirmations, requires a successful receipt, confirms contract code exists, then writes `deployments/botchainMainnet.json` with: network, chain id, address, deployment transaction hash, receipt status, deployment block, gas used, compiler version and settings, `codeExists`, deployed time, explorer URL and `verified: false`.

   If the script stops with an error, read it. Do not rerun blindly. If a transaction was already sent, find it on https://scan.botchain.ai before doing anything else.

3. Verify the source on the explorer.

   ```bash
   npm run verify:mainnet
   ```

   This updates the record with `verified: true` and the verification URL. If it fails, check `BOTCHAIN_MAINNET_API_KEY` and `BOTCHAIN_SCAN_API_URL` in `.env`, then retry. The record keeps `verificationError`.

4. Record the artifacts.

   ```bash
   npm run export-abi
   git add deployments/botchainMainnet.json abi/WinkGiftVault.json
   git commit -m "Record BOT Chain mainnet deployment"
   git push origin main
   ```

   Note the address, the deployment block and the transaction hash for the evidence list.

## C. Vercel configuration

Set these in the Vercel project (Production). They are public values.

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_WINK_NETWORK` | `mainnet` | Switches the whole site. Leave as `testnet` until the end of this section. |
| `NEXT_PUBLIC_VAULT_ADDRESS_MAINNET` | the deployed address | Must be a valid non-zero address. |
| `NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_MAINNET` | the deployment block number | Positive integer from `deployments/botchainMainnet.json`. |

Rules the app enforces:

- If either mainnet value is missing or invalid the app is "not configured": the vault is null, creation is disabled and no claim or reclaim control appears. It never falls back to the testnet vault.
- `NEXT_PUBLIC_WINK_NETWORK` accepts only `testnet` or `mainnet`. Anything else disables writes.
- Testnet values (`NEXT_PUBLIC_VAULT_ADDRESS_TESTNET`, `NEXT_PUBLIC_VAULT_DEPLOY_BLOCK_TESTNET`) can stay set. They are not used in mainnet mode.

Secret variables (server only, never prefixed `NEXT_PUBLIC_`):

- `DATABASE_URL` (Neon). Already set.
- Optional: `BOTCHAIN_MAINNET_RPC` to use a different RPC for server-side health checks.

Never set in Vercel: `PRIVATE_KEY`, `WINK_CONFIRM_MAINNET_DEPLOY`, `WINK_ALLOW_REDEPLOY`.

Mainnet activation order:

1. Set the two mainnet variables first while `NEXT_PUBLIC_WINK_NETWORK` is still `testnet`. Redeploy. The site is unchanged.
2. Check readiness against production:

   ```bash
   BASE=https://usewink.vercel.app npm run readiness
   ```

   and open `https://usewink.vercel.app/api/health?deep=1`. Under `chains.mainnet` you want `configured: true`, the correct address and block, `codeOnChain: true` and `launchReady: true`.
3. Set `NEXT_PUBLIC_WINK_NETWORK=mainnet`. Redeploy. NEXT_PUBLIC values are inlined at build time, so a redeploy is required for any change.
4. Verify the redeploy: the nav shows "Mainnet", the footer says "Currently running on BOT Chain", `/api/health` reports `activeNetwork: "mainnet"`, and `/create` shows the funding form with no "not live" message.

## D. Real mainnet acceptance

Use two wallets: A (sender) and B (recipient). Use small real amounts. Do each step on https://usewink.vercel.app and keep every transaction hash.

1. Create a funded gift from A. Confirm the wallet shows chain 677, you approve the transaction, and the app only navigates after confirmation.
2. Confirm `GiftCreated` on the explorer for that transaction, from the vault address, with the expected sender, recipient and amount.
3. Retrieve metadata: open `/api/metadata/<metadataHash>` (the hash is on the gift page's on-chain data) and confirm the note matches. Also confirm the gift page shows the note.
4. Open the share URL in a different browser or a private window with no wallet connected. It must load the gift, show "Connect to claim" and no claim button.
5. Connect B and claim. Confirm B received exactly the gift amount (less only gas, which A or B paid separately), `GiftClaimed` is on the explorer, and the page shows Claimed with the proof link.
6. Sender-only reclaim constraints: with a second gift, connect A before expiry and confirm there is no reclaim button, only the countdown. Connect a third wallet and confirm no reclaim and no claim.
7. Real expired reclaim: create a gift with a short expiry (2 hours is the UI minimum), do not claim it, wait until it has genuinely expired, connect A and reclaim. Confirm `GiftReclaimed` and the page state. Do this only with a gift that naturally expired. Never fake timestamps.

Mark each step done in the evidence list below with the transaction hash.

## E. Launch evidence

Collect and keep:

- Website URL: https://usewink.vercel.app
- Contract address and verification URL (`https://scan.botchain.ai/address/<address>#code`)
- Deployment transaction hash and block
- Real transactions: create, claim, reclaim, with explorer links
- The X (Twitter) account and the launch post links
- The official mainnet launch announcement, only after steps D1 to D5 pass
- Screenshots of the verified contract page and a claimed gift page

Ongoing monitoring:

- `GET /api/health?deep=1` on a schedule: expect `launchReady: true` for the active network.
- `npm run readiness` with `BASE` set, after every deploy.
- Watch the vault's events on the explorer. Watch Neon for errors and the metadata API for 5xx.
- Keep some mainnet BOT in a test wallet for smoke tests after each release.

## F. Rollback and failure plan

Know what each failure can and cannot fix.

| Situation | What to do | What this does not fix |
| --- | --- | --- |
| Website bug after switching to mainnet | Set `NEXT_PUBLIC_WINK_NETWORK` back to `testnet` and redeploy, or roll back the Vercel deployment. | Gifts already created on mainnet stay in the vault. They follow the contract rules. |
| Wrong or missing mainnet variables | The app shows "not configured" and disables writes. Fix the variables and redeploy. | Nothing on chain was affected. |
| Metadata API or Neon outage | Gift pages still show amount, parties, expiry and the claim and reclaim controls from the chain. Notes show a fallback message. Creation pauses because the note cannot be saved. | Notes already stored are unaffected once the database returns. |
| Deployment script fails before sending | Fix the reported problem and rerun. No transaction was sent. | |
| Deployment succeeded but verification failed | Retry `npm run verify:mainnet`. The contract works without verification, but do not announce launch until it is verified. | |
| Bug found in the contract itself | Stop promoting mainnet, switch the site back to testnet, and tell users plainly. The contract cannot be changed or paused. A fixed contract needs a new deployment at a new address and a fresh announcement. | Funds already in the old vault can only leave through its own claim and reclaim rules. Do not promise recovery. |
| Leaked deployer key | The vault has no admin powers, so the key cannot touch gifts. Rotate the key for future deployments and review wallet exposure. | |

## Appendix: commands at a glance

```bash
npm run preflight:mainnet
WINK_PREFLIGHT_STRICT=1 npm run preflight:mainnet
WINK_CONFIRM_MAINNET_DEPLOY=deploy-wink-vault-to-botchain-mainnet-677 npx hardhat run scripts/deploy.js --network botchainMainnet
npm run verify:mainnet
npm run export-abi
BASE=https://usewink.vercel.app npm run readiness
```
