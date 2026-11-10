# Wink — Product Requirements Document (PRD)

**Status:** Implementation-ready draft v1.0 · **Date:** 2026-11-10  
**Brand:** Wink (locked; formerly BOTBOX) · **Chain:** BOT Chain mainnet, chain ID 677  
**Launch target:** Friday, 2026-11-13 · **Supporting docs:** `TRD.md`, `architecture.md`, `projectplan.md`.

> **Proposed product articulation (not finalized brand copy):** Wink makes native BOT feel like a thoughtful gift. A sender chooses a recipient wallet, funds an occasion-specific gift and shares a reveal page; only the nominated wallet can claim it.

## 1. Problem, audience and why this belongs on BOT Chain

A normal cryptocurrency transfer communicates the amount but little human meaning. For birthdays, thank-yous and community appreciation, people want to express intent and make the recipient feel acknowledged. A gift page adds a personal moment, while an on-chain vault makes the money delivery verifiable. This gives people a reason to introduce someone else to BOT Chain through actual usage.

**Job to be done:** "When I want to thank someone with BOT, let me make it feel like a gift, send it securely to their wallet and know whether they claimed it."

**Primary users:** (1) friends who already have EVM wallets, (2) creator communities thanking contributors, (3) Web3 newcomers receiving their first BOT. Newcomer support is a product ambition, **not** a promise of a gasless wallet onboarding flow in V1.

**Different from Quilt:** Wink is one sender → one preselected recipient, with a themed reveal, expiry and reclaim state. Quilt is multiple predetermined recipients sharing a single payment and has no gift escrow/reveal lifecycle. Their contracts and UI must not be wrappers around identical transfer operations.

## 2. Core value and success criteria

- A sender can create a **recipient-address-bound** gift with a specific native-BOT amount, short note, visual theme and expiry.
- Sender receives a link that opens a delightful, mobile-first gift-reveal screen.
- Only the specified recipient wallet can claim **before expiry**; recipient sees clearly that they need a small amount of BOT to pay gas.
- If gift remains unclaimed when expiry arrives, **the original sender alone** can reclaim it.
- Contract guarantees no double claim, no double reclaim and no other wallet withdrawal.
- Every stage displays real on-chain state and provides transaction proof; post-launch operation is monitored.

**MVP completion:** One authentic sender funds a gift, a distinct intended recipient claims it on mainnet, and the public page correctly becomes "claimed." Mary's independent usage target is ≥3 genuine wallets and ≥5 qualifying core gift actions within 7 days of the live date; these must represent real gifting, not circular self-funding.

## 3. MVP features and acceptance criteria

| ID | Must-have | Acceptance test |
| --- | --- | --- |
| W-P01 | Wallet and BOT Chain support | Connect, switch/add chain 677, show account and BOT gas balance. |
| W-P02 | Gift composer | Valid recipient address, BOT amount, occasion style, short note and expiry. |
| W-P03 | Create/fund gift | One wallet transaction locks native BOT and emits a unique `giftId`. |
| W-P04 | Gift share page | Stable `/g/{giftId}` link, human-friendly reveal animation, accurate live state. |
| W-P05 | Recipient-only claim | `claim(giftId)` succeeds for nominated wallet before expiry, fails for all other wallets. |
| W-P06 | Sender reclaim | `reclaim(giftId)` succeeds for original sender at/after expiry only if gift is still unclaimed. |
| W-P07 | Claim requirements | Non-holder sees gift description, but cannot falsely claim; recipient sees BOT gas warning and correct wallet prompt. |
| W-P08 | Reliable lifecycle UI | Draft → awaiting funding → funded → claimed **or** expired/reclaimed; pending ≠ confirmed. |
| W-P09 | Independent public presence | Own domain/app, X account, BOT Chain links in footer, actual launch post and support contact. |
| W-P10 | Privacy-safe copy | Clearly state wallet addresses and transaction history are public; note privacy is not guaranteed if shared by URL. |

### Required user flow

**Sender:** Open Wink → Connect → Enter recipient address → Set BOT amount + gift note/theme + expiry → Review amount, recipient and gas → Fund gift on-chain → On successful receipt, copy shareable URL → View status.

**Recipient:** Open gift URL → Reveal card → See intended wallet (abbreviated) → Connect correct wallet → Verify chain and BOT gas → Claim before expiry → Success receipt. If wrong wallet, show an explanation instead of an enabled claim button.

**Recovery:** Sender opens same link after expiry → Connect original funding wallet → Reclaim unclaimed BOT → Verify status and receipt. If gift was claimed, reclaim is permanently disabled.

## 4. Content and experience constraints

- Warm, tactile, celebratory and simple—not a trading terminal, casino or token mint page.
- Visual reveal is only an interface effect. Do **not** imply hiding the asset balance or recipient on a public blockchain.
- Gift preview can display a note, but note content is not confidential. Offer simple warnings against sensitive information.
- Funds are held temporarily in a smart contract. Explain that unclaimed gifts stay locked until claim or eligible reclaim; smart-contract risks exist.
- The recipient must have BOT for gas in V1. Never promise email-only receiving, free claims, sponsored gas or anonymous bearer links.
- Use exact native BOT denominations; avoid currency conversion claims without a reliable quote source.

### Screens/routes

`/` landing and occasion examples; `/create` gift composer; `/g/[giftId]` reveal, status, claim/reclaim; `/sent` optional wallet-filtered list; `/help` gas, security and support FAQ.

## 5. Business rules

1. One gift has **one nominated EVM recipient**, **one original sender**, **one amount**, **one deadline**, and one final state.
2. V1 only supports native BOT and exact recipient addresses. No email, Twitter handle or human-readable-name delivery.
3. Sender submits positive native value and expiry inside allowed bounds (recommended 1 hour–30 days from creation). Sender cannot cancel early.
4. `claim` requires correct recipient, funded state and `block.timestamp < expiresAt`.
5. `reclaim` requires original sender, funded state and `block.timestamp >= expiresAt`.
6. Both terminal actions update state before external payment and revert completely if the transfer fails.
7. Gift metadata should be display-only, hash-anchored to the funded gift when possible, and not trusted to authorize payout.
8. If recipient is a contract wallet that rejects native BOT, claim reverts and remains available until expiry; disclose this constraint.

## 6. Explicit non-goals and later opportunities

**Not in launch:** secret-only claim links (front-running risk), ERC-4337 gas sponsorship, fiat on/off-ramp, batch gifts, token gifts, social login or user-created public fundraisers.

**Later:** sponsored recipient gas, wallet onboarding handoff, group surprise cards, scheduled reveals, multi-gift bundles and verified creator pages. Each needs separate security and cost review.

## 7. Independent acceptance under Mary's criteria

Wink needs its own official X with five valid posts in the prior 30 days; a project-authored announcement explicitly saying **"Wink has officially launched on BOT Chain mainnet"** after go-live; a publicly accessible, usable website with BOT Chain name/logo and `https://botchain.ai` + `https://scan.botchain.ai` in the footer; a successful real funded-gift-and-claim path; clear independence from Quilt/Trail; ≥3 genuine participant wallets and ≥5 genuine core actions in the seven-day post-launch window; and ongoing website/social/community operation.

**Proof bundle:** contract verification, funding/claim/reclaim tx hashes where genuinely available, screenshots of lifecycle states, a permissioned user demo, X post links, exact launch date, uptime report and pending issues. **Never use wash gifting or self-gift loops to simulate demand.** Confirm with Mary whether `createGift`, `claim` and `reclaim` each count and how the deadline is interpreted.

## 8. Release acceptance and known decisions

- [ ] Testnet sender → recipient claim works; all unauthorized and boundary cases fail correctly.
- [ ] Small-value real mainnet gift claimed by a distinct real recipient; verified contract and explorer receipts.
- [ ] Expiry/reclaim path tested with controlled shortened testnet expiry, not by falsifying clock data.
- [ ] Share link is usable in a fresh browser and does not claim recipient gas is paid.
- [ ] Site, X, official links, support channel and uptime monitoring work independently.

**Locked:** gift concept, native BOT, recipient-bound claims, expiry/reclaim, independent Wink brand.  
**Open:** approved tagline/visual system, final domain and handle, exact test participants, Mary's eligibility counting, agreed commercial terms.

**References:** [BOT Chain quick guide](https://dev-docs.botchain.ai/docs/Developers/quick-guide/), [wallet and domain safety](https://www.botchain.ai/en/help-center/docs/security-help/official-links-and-anti-scam/). Source concept was BOTBOX, now branded Wink.
