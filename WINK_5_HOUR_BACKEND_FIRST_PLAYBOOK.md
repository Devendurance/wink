# WINK — Backend-first, five-hour build playbook

**Working date:** 2026-11-10 · **Target:** functional, tested native-BOT gifting MVP on BOT Chain mainnet (677).  
**Repository:** https://github.com/Devendurance/wink · **Status observed:** public, `main`, empty at inspection.  
**Product identity:** Wink is a standalone gift product. Not Quilt's payment splitter and not Trail's review directory.

> **Shipping rule:** No frontend contract integration or irreversible mainnet deployment before the contract is implemented, tested and exercised end-to-end on a development chain. Five hours is an execution target, not a safety exemption. If a security gate fails, do not launch a custodial smart contract.

## 0. Definition of done

A sender picks a recipient address, chooses a message/theme/expiry, funds native BOT into the Wink vault, receives `/g/{giftId}`; that recipient opens the link, connects a supported EVM wallet on BOT Chain, and claims. The vault transfers the exact amount once. If it remains unclaimed after expiry, only the original sender can reclaim. The public page reconstructs status from chain and displays a verified explorer receipt. Critical failure cases are tested. The working website names BOT Chain and links to its website and explorer. The app, X account, and launch artifacts are independently operated.

**Not V1:** anonymous bearer-link claims, gas sponsorship, gift cards denominated in USDT, account creation, cross-chain bridging, multi-recipient gifts, fiat, early cancellation, on-chain secret messages, payment fees, or upgradeable custody.

### Official chain settings

| Environment | Chain ID | RPC | Explorer | Asset |
|---|---:|---|---|---|
| Bohr testnet | 968 | https://rpc.bohr.life | https://scan.bohr.life | test BOT |
| BOT Chain mainnet | 677 | https://rpc.botchain.ai | https://scan.botchain.ai | BOT |

Check `eth_chainId` from actual RPC before sending transactions. Testnet faucet: https://faucet.botchain.ai. Recipients need BOT to pay their own claim gas; this MVP is not gasless. Reference: https://dev-docs.botchain.ai/docs/Developers/quick-guide/.

## 1. Five-hour critical path

| Elapsed | Focus | Deliverable | Hard exit gate |
|---|---|---|---|
| 00:00–00:20 | Bootstrap/recon | Clone empty GitHub repo, confirm Node, package manager, Solidity toolchain, RPC chain IDs; create safe env examples | Repo tracks `origin`; chain IDs are correct; no secrets committed |
| 00:20–01:35 | **Backend 1: smart contract** | `WinkGiftVault.sol`, deployment script, broad unit/fuzz/invariant tests | `forge test` (or Hardhat equivalent) green; unauthorized claims/refunds and double-withdrawals fail |
| 01:35–02:20 | **Backend 2: metadata service + read APIs** | Deterministic gift content hash, persistence for public note/theme, validation, deduplication, rate limit, read status helpers, deployment config | API tests green; metadata hash matches chain hash; unavailable metadata cannot block a claim |
| 02:20–02:55 | **Backend 3: chain proof** | Local sender/recipient/full expiry test, verified testnet deployment, real testnet `GiftCreated` and `GiftClaimed` receipts | Testnet lifecycle is real; `claim` transfers exact amount; receipt/event decode works |
| 02:55–04:00 | **Frontend integration** | Responsive create, reveal/claim, expiry/reclaim, transaction state, wallet/chain switching, explorer links, accessible UX | Fresh browser can perform sender→recipient journey against testnet |
| 04:00–04:40 | Mainnet release | Source-verified vault deployed at 677, production env and site configured, Vercel deployment, small-value genuine claim | Contract address/ABI match; mainnet receipt confirms transfer; site live |
| 04:40–05:00 | Production QA + evidence | Mobile check, wrong-wallet/expiry states, read-only fallback, launch assets and handoff | No critical bugs; can verify contract/tx from public URLs; operations owner assigned |

**Schedule reality:** API setup, faucet availability, on-chain finality, explorer verification and wallet/gas availability can exceed their allocated windows. Prioritize hard safety gates and verified product flow over extras. Mary's 7-day real-user criterion cannot honestly be declared complete in this five-hour sprint.

## 2. Contract — canonical specification

```solidity
enum GiftState { Unset, Funded, Claimed, Reclaimed }

struct Gift {
    address sender;
    address recipient;
    uint256 amount;
    uint64 expiresAt;
    bytes32 metadataHash;
    GiftState state;
}

function createGift(address recipient, uint64 expiresAt, bytes32 metadataHash)
    external payable returns (uint256 giftId);
function claim(uint256 giftId) external;
function reclaim(uint256 giftId) external;
function getGift(uint256 giftId) external view returns (Gift memory);
```

Events: `GiftCreated(giftId, sender, recipient, amount, expiresAt, metadataHash)`, `GiftClaimed(giftId, recipient, amount)`, `GiftReclaimed(giftId, sender, amount)` with appropriate indexed IDs/accounts. A monotonically increasing gift ID is sufficient. A public gift URL is **not** a withdrawal key.

**Invariant rules:**

1. `msg.value > 0`; recipient valid and not sender for V1; expiry `>= now + 1h` and `<= now + 30d` (explicitly document if changed for UX).
2. On `claim`: `state == Funded`, `msg.sender == recipient`, `block.timestamp < expiresAt`.
3. On `reclaim`: `state == Funded`, `msg.sender == sender`, `block.timestamp >= expiresAt`.
4. Claim/reclaim set terminal status **before** external value transfer; use checked native `call`, `nonReentrant`, revert on failure.
5. Never allow double claim/reclaim, early sender cancellation, third-party withdrawal or privileged operator drains.
6. Contract storage is authoritative; events/receipts and read functions allow page reconstruction after reload.
7. Do not claim arbitrary `receive()` native BOT as a gift; reject direct transfer where possible.

**Mandatory contract cases:** create happy path; zero amount/address; self-gift; expiry too short/too long; missing ID; wrong recipient; wrong sender; expired claim; premature reclaim; exact deadline boundary; successful claim; successful refund; double withdraw; malicious receiving contract reverting; receiver reentering; exact amount/account balance delta; multiple independent gifts; event values; invariant: no funded amount released more than once. Test time boundaries with local chain clock warp; optionally prove live testnet reclaim with a separately prepared aged gift.

**Deployment:** Foundry preferred if already available on agent's host. If missing and installing it would derail the deadline, Hardhat + Solidity tests is an acceptable fallback. Pin contract toolchain/compiler and OpenZeppelin dependencies. Never deploy only because compilation succeeds.

## 3. Backend services — deliberately minimal

Financial custody, claim permissions and status **must not rely on the backend**. A Next.js API is for publicly viewable gift presentation data and optional indexing only.

### Metadata schema

```ts
type PublicGiftMetadata = {
  v: 1;
  theme: 'sunrise' | 'confetti' | 'night-sky';
  note: string; // <= 280 characters; plain text; NOT private
};
```

Define canonical JSON serialization with stable ordered keys and normalization (never trust arbitrary JSON key order), compute `keccak256` over UTF-8 bytes, store `(hash PRIMARY KEY, canonical_json, created_at)` in a lightweight Postgres/Neon table or another durable store, and pass the same hash to `createGift`. Sanitize note; strip any HTML; no clickable user-supplied links; limit body size and basic rate limit. A new gift may create orphaned metadata if the wallet cancels; harmless and optionally prunable. A metadata outage must not prevent claim/reclaim from reading contract state.

### Minimal endpoints

- `POST /api/metadata`: validate allowlisted theme, plain-text note length/size, normalize and hash; persist idempotently; return `{ hash }`.
- `GET /api/metadata/:hash`: return only exact hash-matching canonical public payload, or not found.
- Optionally `GET /api/health`: returns service health but must not leak env/keys.

Chain reads (`getGift`, `GiftCreated`, claim/reclaim receipts) can be performed from viem/public RPC in the client or server. Never place deployer private key or financial signing keys in these APIs. Contract method signatures/ABIs come from the compiled verified artifact, not hand-maintained guesses.

## 4. Frontend contract integration (only after backend gate)

Use Next.js App Router / React / Tailwind / `wagmi` + `viem` on a clearly defined BOT Chain network. Essential routes:

- `/`: landing, what a gift is, creation CTA, official BOT Chain footer links.
- `/create`: recipient address, BOT amount, expiry, theme, note, preview, wallet write, pending/failed/confirmed state, gift link.
- `/g/[giftId]`: public share/reveal page, chain-backed gift state and metadata hash check; shows correct role-specific claim/reclaim actions and explorer proof.
- `/help`: explains gas, public recipient/transaction info, deadlines, why link possession does not grant withdrawal.
- Optional `/sent`: sent gifts indexed from creation events or a durable read-only index; never block primary flow on it.

Wallet writes: check chain 677; preflight `simulateContract`; request wallet signature; `writeContract`; wait for confirmed receipt, verify status success and *events from canonical address*; reload canonical gift. Display states `idle / awaiting-wallet / pending / confirmed / failed`. On any RPC error, show uncertainty rather than fake success. Render public gift page without a wallet connection. Warn recipients they need BOT gas.

Accessibility: responsive at 360px, keyboard controls, informative error messages, reduced-motion support for reveal animation. Use own brand identity, not Quilt's finance UI.

## 5. Mainnet release and evidence

**Before production:** successful backend tests; testnet create and claim with two different wallets; clear unauthorized/reclaim boundary tests; no known high severity custody bug; verified source; ABI matches deployed bytecode; deployer funded for gas; tiny-value pilot. Check environment variables and site links; never commit `.env` or raw private keys.

**Mainnet proof:** verified `WinkGiftVault` address, deployment transaction, `GiftCreated` receipt, claim receipt from real intended wallet, amount/status read check, and stable share URL. Publish exact explorer URLs and timestamps only after successful confirmation.

**Mary's eligibility:** own X account, >=5 substantive posts in 30 days, explicit mainnet-launch announcement from Wink account, working web app with BOT Chain name/logo and both links (`https://botchain.ai`, `https://scan.botchain.ai`), genuine core wallet action, product independence, >=3 genuinely distinct wallets and >=5 genuine on-chain core interactions within 7 days, ongoing site/social operation. No coordinated self-gifts, batch accounts or bogus usage; confirm with Mary which create/claim/reclaim operations she counts.

### Proof ledger to fill after execution

| Item | Evidence |
|---|---|
| Git commit / branch | `TBD` |
| Test command + passes | `TBD` |
| Mainnet chain ID checked | `TBD` |
| Vault address + verification | `TBD` |
| Sender / recipient distinct wallets | `TBD` |
| Funding receipt | `TBD` |
| Claim receipt | `TBD` |
| Reclaim test evidence | `TBD` |
| Production URL | `TBD` |
| Wink X + official launch | `TBD` |
| Mary count/acceptance | `PENDING` |

## 6. GitHub setup — repo is already created and EMPTY

Preferred on agent's environment:

```bash
git clone https://github.com/Devendurance/wink.git
cd wink
git remote -v
git status -sb
```

Git may warn that the repository is empty. That is expected; it doesn't need another `git init`. Create the application files, add a proper `.gitignore` (`.env*` ignored except `.env.example`, `node_modules`, build outputs, Foundry/Hardhat artifacts as appropriate) and safe README. Then:

```bash
git add .
git commit -m "chore: bootstrap Wink backend-first project"
git branch -M main
git push -u origin main
```

If coding agent is already inside a local folder with uncommitted work, inspect and preserve it; don't reclone into it, replace files or force-push. The user-provided `git init ... git remote add origin` sequence is an alternate path for a brand-new local folder, not something to run inside a cloned repo.

## 7. Pi workflow — multi-slice MVP

Use the preconfigured `/skill:fast-build` because this is a genuinely multi-slice app. Track durable progress and decisions in `.fast-build/STATE.md`; **one meaningful vertical slice per fresh Pi session**. Do not restate the skill rules or do a whole-repo audit when the repo is known to be empty.

**Session A: initial contract/backend foundation** → repo initialization; contracts, tests, scripts, env examples, deployment readiness; commit/push. Do not build frontend beyond minimal shell until contract gates pass.

**Session B: backend metadata and testnet lifecycle** → public note/theme storage and hash verification; APIs/tests; actual testnet gift/claim proof. Commit/push.

**Session C: frontend end-to-end** → gift composer, wallet connection, reveal/claim/reclaim UI, confirmations and full testnet flow. Commit/push.

**Session D: production launch proof** → mainnet deploy, verification, frontend live, tiny-value real gifts, edge QA, documentation and evidence dossier. Commit/push.

If a required milestone is blocked, report the exact blocker; don't silently substitute a demo/mocked chain or claim a production launch.

### First Pi prompt (copy exactly)

```text
/skill:fast-build

Project: Wink, an independent native-BOT gifting DApp on BOT Chain.
Repository: https://github.com/Devendurance/wink.git (public, main, observed empty).
Deadline: 5-hour MVP sprint. This is SESSION A / BACKEND-FIRST.

Goal: Set up the repository and implement the REAL custodial gift-vault contract with full security-focused unit/fuzz tests and deployment tooling. Do not begin product frontend/wallet wiring in this session. Don't execute a mainnet deployment.

Repo setup:
- Clone if absent; if current checkout exists, inspect git status and preserve it. Do not run git init inside an existing clone.
- Initialize a lean app workspace with a standalone contracts package, safe .gitignore, env examples and a README.
- Detect installed tooling first; prefer Foundry if available, otherwise use Hardhat if Foundry installation would consume sprint time. Pin dependencies.
- Check BOT Chain testnet (968, https://rpc.bohr.life) and mainnet (677, https://rpc.botchain.ai) chain IDs via RPC; don't assume reachability.

Implement WinkGiftVault:
- createGift(address recipient, uint64 expiresAt, bytes32 metadataHash) payable creates unique giftId with original sender, amount, recipient, deadline, metadataHash and Funded state.
- claim(id) only for matching recipient while Funded and block.timestamp < expiresAt.
- reclaim(id) only for original sender while Funded and block.timestamp >= expiresAt.
- Disallow zero-value gift, zero recipient, self gifting and expiry outside 1 hour to 30 days.
- Update final state before sending native BOT, use nonReentrant + checked low-level call, ensure transfer failure reverts.
- getGift(id), relevant events for creation/claim/reclaim. No admin funds access, no upgradeable proxy, no hidden fees.
- Link possession must never authorize claim. Sender/recipient identity comes from msg.sender, not metadata.

Test: success create/claim/reclaim, boundary timestamps, unauthorized withdrawal, double claim/reclaim, bad addresses/amount/expiry, reverting recipients, reentrancy attempts, multiple gifts, balance conservation and exact events. Use local time warp; tests must be deterministic. Include deploy script, env.example and reproducible commands.

Acceptance: contract compile/tests pass, no critical known financial-security issues, testnet deploy readiness established, artifacts/ABI generated. Don't mark unexecuted verification as done. Report exact file changes, test commands/results, any warnings/blockers, git commit/push and updated .fast-build/STATE.md.

Stop after this bounded backend slice. Next slice should be metadata persistence, API and actual testnet lifecycle proof.
```

### Session B prompt

```text
/skill:fast-build

Continue Wink from the existing repo and .fast-build/STATE.md. Do not rebuild or refactor the validated gift-vault contract without a specific failing test. This session is BACKEND METADATA + REAL TESTNET PROOF only.

Implement a minimal persistent public note/theme metadata API; canonical hash anchored to the vault; input validation, sanitization and rate limiting; read helpers and tests. Explicitly document public notes and absence of gas sponsorship. Deploy verified contract to testnet 968 and produce real testnet createGift and claim tx hashes using distinct test wallets. Exercise reclaim via local time-warp test and a true expired testnet gift if feasible without unsafe shortcuts. Test DB unavailable and wrong hash cases. Commit and push; update .fast-build/STATE.md and report evidence. Do not start frontend wallet wiring until backend gates pass.
```

### Session C prompt

```text
/skill:fast-build

Continue from .fast-build/STATE.md. Connect Wink frontend to the tested gift vault and metadata API; no mocked chain writes. Build a polished standalone Wink consumer experience: /, /create, /g/[giftId], /help. Implement EVM wallet connect + BOT Chain 677/968 environment config, wrong-network handling, recipient-only claim, sender-only reclaim after expiry, precise amounts and deadline, gas warnings, public reveal, verified metadata, receipts, and real pending/failed/confirmed states. Run build/lint/types and one complete testnet sender-to-recipient browser flow. Preserve previously verified backend; commit/push and report.
```

### Session D prompt

```text
/skill:fast-build

Continue Wink from .fast-build/STATE.md with the existing working testnet product. Deploy a verified production gift vault to BOT Chain mainnet chainId 677 ONLY after confirming security tests and user-approved small-value wallet funding. Deploy independent Wink frontend with correct env/contract address, BOT Chain website/explorer footer links and public support. Execute a real small-value sender-to-recipient gift funding + claim; verify amounts and source on explorer, record tx hashes, screenshots, smoke test on mobile and report unresolved risks. Do not claim Mary's seven-day criteria or official mainnet launch until they are factually met. Commit/push exact deployment artifacts and proof report.
```

## 8. Security release gate

**Never waive:** unauthorized withdrawal tests, double-withdrawal protection, deadline boundary checks, reentrancy resistance, reverting receiver behavior, exact amount conservation, chain ID/address checks, successful real testnet claim and live mainnet smoke test. Code-generated tests alone do not amount to an external audit; keep initial sums small and transparently label the MVP experimental until reviewed.

**Source references:** https://dev-docs.botchain.ai/docs/Developers/quick-guide/, https://scan.botchain.ai, https://viem.sh/docs/contract/writeContract, https://docs.openzeppelin.com/contracts/5.x/api/utils.
