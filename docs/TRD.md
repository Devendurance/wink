# Wink — Technical Requirements Document (TRD)

**Status:** Implementation-ready draft v1.0 · **Date:** 2026-11-10 · **Mainnet:** BOT Chain (677)

## 1. Technical goal

Build a minimal native-BOT gift-vault contract and an independent consumer DApp. Sender funds a unique gift for a **fixed recipient address**; the recipient can claim before expiry and the sender can reclaim afterward. A shareable URL is a display mechanism, **not a possession-based authorization credential**.

## 2. Technology and environment

- Web: Next.js App Router / React / TypeScript / Tailwind with `viem` and `wagmi` wallet support; accessible reveal and state UX.
- Contracts: Solidity `^0.8.24`, pinned Foundry, pinned OpenZeppelin 5.x `ReentrancyGuard`.
- Metadata: Minimal DB or content store for public card style/note and gift mapping; canonical gift value, recipient and status are always read from the chain. Prefer a content hash bound during gift creation.
- Environment: Bohr testnet 968 (`https://rpc.bohr.life`, explorer `https://scan.bohr.life`) and BOT mainnet 677 (`https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`). Native BOT is gas and gift asset.
- Hosting: separate Wink frontend and, if metadata persistence is used, an isolated data namespace and deploy environment. No shared Quilt wallet-payment contract.

## 3. Contract model

```solidity
enum GiftState { Unset, Funded, Claimed, Reclaimed }

struct Gift {
  address sender;
  address recipient;
  uint256 amount;
  uint64 expiresAt;
  bytes32 metadataHash; // hash only; never plaintext note
  GiftState state;
}

function createGift(address recipient, uint64 expiresAt, bytes32 metadataHash)
  external payable returns (uint256 giftId);
function claim(uint256 giftId) external nonReentrant;
function reclaim(uint256 giftId) external nonReentrant;
function getGift(uint256 giftId) external view returns (Gift memory);

event GiftCreated(uint256 indexed giftId, address indexed sender, address indexed recipient, uint256 amount, uint64 expiresAt, bytes32 metadataHash);
event GiftClaimed(uint256 indexed giftId, address indexed recipient, uint256 amount);
event GiftReclaimed(uint256 indexed giftId, address indexed sender, uint256 amount);
```

### Invariants, authorization and lifecycle

- `createGift`: `msg.value > 0`, recipient not zero, recipient different from sender for V1 (avoid accidental self-gifting), expiry > current time + **minimum lead**, <= current time + 30 days. Use `>= 1 hour` as recommended minimum; test on testnet with deploy-specific configuration rather than dangerous ad hoc mainnet exception.
- `claim`: `state == Funded`, `msg.sender == recipient`, and `block.timestamp < expiresAt`. Set `Claimed` **before** transferring BOT using `call`; revert if payment call fails. Protect entrypoint against reentrancy.
- `reclaim`: `state == Funded`, `msg.sender == sender`, `block.timestamp >= expiresAt`. Set `Reclaimed` before payment; revert if transfer fails; no early cancel.
- `Claimed` and `Reclaimed` are terminal and mutually exclusive; no partial withdrawals or arbitrary admin rescue of user gifts.
- A private link, `giftId`, note, database token or website cookie must **never** permit a non-recipient claim.
- Reject direct ETH/BOT transfers to contract outside `createGift` when practical; forced transfers are not user gifts and cannot be assigned to a different gift.

### Metadata binding

Prepare a canonical UTF-8 serialization such as:

```json
{"v":1,"style":"sunrise","note":"Thank you for helping!"}
```

Normalize and hash its raw canonical bytes using `keccak256`; pass `metadataHash` to `createGift`. The public page fetches note/style (if available), recomputes the hash and compares it to chain. Missing/altered metadata does **not** block fund claim; UI displays "message unavailable" if verification fails. Keep the recipient address and amount on-chain; do not store secret messages or private identity data in URL parameters or contract events.

## 4. State machine and error model

```text
          createGift (funds locked)
  Unset --------------------------------> Funded
                                           | \
              claim: recipient, before TTL |  \ reclaim: sender, at/after TTL
                                           v   v
                                        Claimed Reclaimed
```

UI states should distinguish `awaiting-signature`, `pending`, `funded`, `claimable`, `expired-unclaimed`, `claimed`, `reclaimed`, `reverted`, and `not-eligible-wallet`. Display actual contract state instead of inferring terminal status solely from local browser state.

**Errors to handle:** wrong network, insufficient BOT for gift + estimated gas, wallet rejection, bad recipient, invalid expiry, wrong claimant, expired claim, premature reclaim, double action, RPC timeout, recipient contract rejecting BOT, unavailable metadata. A "pending" transaction is never shown as settled.

## 5. Frontend integration and APIs

- `useAccount()`/wallet provider supplies the signer. Preflight chain ID 677 for writes.
- `createGift` flow: prepare metadata → compute hash → `simulateContract` with exact `value` → wallet write → `waitForTransactionReceipt` → decode `GiftCreated` from canonical vault address → publish `/g/{giftId}`.
- Gift detail: fetch `getGift`, reconcile state and deadline against chain timestamp where possible; display creator, designated recipient, BOT amount, expiry, verified metadata and actions relevant to connected wallet.
- `claim` and `reclaim`: check role and current on-chain state, simulate, call, await confirmed receipt, then refetch gift. Contract is authoritative if UI gets stale.
- Optional API `POST /api/metadata` (validate body lengths, rate-limit, store canonical JSON and content hash), `GET /api/metadata/{hash}` read; metadata fetch must not leak any "private" note because none exists in V1.
- Rate limiting metadata writes and signed sender linkage reduce spam; no sensitive signing keys in browser.

## 6. Security and privacy threats

| Threat | Mitigation |
| --- | --- |
| Anyone learns share URL | URL gives view only; `msg.sender == recipient` enforced on-chain. |
| Expiry race | Exclusive `< expiresAt` for claim and `>=` for reclaim; no overlapping condition. |
| Unauthorized refund | Only original funding wallet; no admin reclaim. |
| Reentrancy / replay | State transition before external `call`, `nonReentrant`, terminal-state guard. |
| Broken receiver transfer | Full revert, state stays `Funded`; show technical explanation. |
| Metadata substituted | Compare off-chain metadata hash with on-chain `metadataHash`. |
| Phishing via fake gift note | Escape/sanitize text, no markdown/HTML or clickable arbitrary links in notes. |
| False gasless promise | Explicit recipient gas requirement on composer and claim page. |
| Wrong-chain funds | Chain ID guard and official explorer domain; contract address per environment. |
| Lost admin key | No admin pathway needed to transfer gifts; deployer cannot override. |

## 7. QA and property tests

**Unit:** amount zero; invalid wallet; self-gift rejection (if adopted); all expiry boundary conditions; third-party claim/reclaim rejection; claimant after expiry; sender before expiry; sender reclaim after expiry; double claim/reclaim; simultaneous role attempts; event fields; note hash; failed receiving fallback; reentrancy; exact transferred amount; multiple gifts independent.

**Fuzz/invariants:** Total funded outstanding equals sum of `Funded.amount` (excluding unsolicited forced BOT). Each gift reaches at most one terminal state, no terminal action sends BOT twice, and unrelated wallets cannot withdraw.

**E2E:** create on testnet → open in fresh mobile browser → connect recipient → show gas copy → claim → receipt. Independently test reclaim with aged gift on testnet. Mainnet small-value gift with real different wallets is mandatory before announcing launch.

## 8. Operations and deployment outputs

```bash
NEXT_PUBLIC_BOT_CHAIN_ID=677
NEXT_PUBLIC_BOT_RPC_URL=https://rpc.botchain.ai
NEXT_PUBLIC_WINK_VAULT_ADDRESS=<set-after-mainnet-deploy>
# DATABASE_URL and DEPLOYER_PRIVATE_KEY are secrets, never NEXT_PUBLIC_
```

Record production ABI, verified vault contract, chain ID, deployment tx, frontend commit, test results and real gift IDs. Verify source with the official BOT explorer. Monitor `/` and `/g/{knownGift}`; do not expose API keys or wallet seed phrases.

**Primary references:** [BOT Chain quick guide](https://dev-docs.botchain.ai/docs/Developers/quick-guide/), [OpenZeppelin ReentrancyGuard](https://docs.openzeppelin.com/contracts/5.x/api/utils), [viem receipts](https://viem.sh/docs/actions/public/getTransactionReceipt).
