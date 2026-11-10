# Wink — Delivery and Launch Project Plan

**Kickoff:** 2026-11-10 · **Mainnet deadline:** 2026-11-13 · **Eligibility operation:** through at least 2026-11-20  
**Deployment target:** BOT Chain mainnet, chain ID 677 (separate Bohr testnet, chain ID 968).
**Release philosophy:** Never trade recipient protection for visual polish; build claim security first, reveal design second.

## 1. Definition of shipped

A working Wink mainnet product means a distinct sender has funded a real gift, the nominated different wallet successfully claims it, unauthorized wallets cannot claim, and the transaction is independently verifiable. The project also needs its own production site, social presence, launch announcement, footer attribution and an operator maintaining it after launch.

**Out of scope this week:** anonymous bearer links, email-delivered crypto, sponsored/gasless claims, multi-asset gifts, early cancellation or account abstraction.

## 2. Critical path schedule

| WAT date | Product milestone | Required evidence |
| --- | --- | --- |
| **Tue Nov 10** | Start repo, design gift state, write & test vault, brand shell, independent X | All fund/claim/reclaim authorization tests green; 2 substantive posts |
| **Wed Nov 11** | Add composer + share page + wallet integration, complete full testnet gift claim | Real testnet `GiftCreated` + `GiftClaimed` and fresh-browser screenshot; third post |
| **Thu Nov 12** | Test expiry/reclaim, reentrancy, recipient fallback, metadata integrity; deploy verified small-value mainnet RC | Contract review checklist complete; production read/claim rehearsal; fourth post |
| **Fri Nov 13** | Production polish, mobile tests, real distinct-wallet claim, publish launch + Mary dossier | Live share link, valid receipts, explicit mainnet announcement; fifth post |
| **Nov 14–20** | Monitor, correct issues, support genuine senders/recipients, collect usage evidence | Genuine activity from ≥3 wallets, ≥5 qualifying actions if possible; no wash patterns |

Post count refers to **Wink's own** account, not the combined accounts of Quilt and Trail. If launch is later, adjust the seven-day window to the actual time.

## 3. Work packages / ordered checklist

### W-01: smart contract / money safety

- [ ] Initialize isolated Foundry project and pin contracts libraries.
- [ ] Implement funded `Gift` records, event IDs and terminal states.
- [ ] Enforce recipient-only claim before expiration and sender-only reclaim at/after.
- [ ] Use `nonReentrant` + checks-effects-interactions; test reverting recipient and attacker fallback.
- [ ] Property-test no double release, exact balances and timestamp boundary.
- [ ] Implement documented deployment and explorer-source verification.

**Gate:** Test suite includes both successful claim and successful reclaim on *different* test gifts; every unauthorized withdrawal fails.

### W-02: real sender/recipient UX

- [ ] Build distinctive, celebratory Wink design (not a Quilt calculator screen).
- [ ] Composer validates recipient, amount, expiry, note and style without exposing secrets.
- [ ] Add wallet, chain switch, pending/confirmed and insufficient-gas handling.
- [ ] Build public `/g/{giftId}` reveal that reads contract state with no sender session.
- [ ] Add claim for nominated wallet, reclaim for sender after expiry, and accurate terminal state.
- [ ] Add sanitized optional public note storage bound by on-chain metadata hash.
- [ ] Run end-to-end test using two genuine different wallets on testnet.

**Gate:** Recipient with no BOT sees gas requirement **before** attempting claim; no false "gasless" messaging.

### W-03: mainnet launch + public presence

- [ ] Create independent Wink X, post five meaningful updates and establish support channel.
- [ ] Publish site with working BOT Chain footer name/logo and `https://botchain.ai`, `https://scan.botchain.ai`.
- [ ] Deploy + verify the mainnet gift vault and publish contract address.
- [ ] Send one small real gift to an independent recipient, capture funding and claim receipts.
- [ ] Confirm expired gift reclaim behavior from testnet and document user limits.
- [ ] Publish project-authored text: "Wink has officially launched on BOT Chain mainnet" once true.
- [ ] Share evidence dossier with Mary and ask for written count interpretation.
- [ ] Turn on uptime/error monitoring and monitor unclaimed gifts/claim support.

## 4. Release blockers vs deferrals

**Blockers:** Recipient mismatch, secret-link authorization, double claim, broken reclaim, gift amount mismatch, no verified contract, no actual mainnet claim, unclear recipient-gas requirement, share link not reconstructable.  
**Deferrable:** Fancy confetti, additional occasion themes, share preview artwork, optional `/sent` history, analytics dashboard.

## 5. Real activity plan, without fake volume

Recruit people who already have a reason to give BOT: creator thank-yous, birthday cards, community appreciation and genuine peer rewards. Let senders choose real recipients independently and explain the recipient needs some BOT gas. Record actual `GiftCreated`/`GiftClaimed` actions, not page views or self-transfer loops. Mary must determine whether both fund and claim count; do not assume every gift equals two eligible interactions.

## 6. Submission evidence log

| Proof item | Status / link |
| --- | --- |
| Live Wink app + source commit | `TBD` |
| Mainnet gift vault verified address | `TBD` |
| One real gift created and claimed by distinct wallets | `TBD` |
| Unauthorized claim/reclaim test evidence | `TBD` |
| X official account, posts and explicit launch post | `TBD` |
| Mary acceptance confirmation | `PENDING` |
| Post-launch monitor & support owner | `TBD` |

Keep wallet addresses/tx hashes public when they are already on-chain, but do not publish real-world identities or personal gift notes without consent.

## 7. Risk register

| Risk | Severity | Prevention |
| --- | --- | --- |
| Exploit in custody/claim | Critical | Lock scope, run negative tests, independent code review, no shortcuts. |
| Recipient lacks BOT gas | High for adoption | Explicit preview and support instructions; no false gas sponsorship. |
| Expiry timing surprises | Medium | UTC timestamp + countdown; exact boundary guards; no early sender refund. |
| Gift note disappears | Low for funds | Contract remains usable without metadata service. |
| Social project looks mass-produced | High for Mary | Own consumer identity, distinct contract and narrative from Quilt/Trail. |
| Slow mainnet confirmation | Medium | Receipt wait, resumable status page, never optimistic "claimed". |

## 8. Agent handoff prompt

> Ship Wink, a standalone native-BOT gift-vault DApp on BOT Chain, from these documents. Prioritize safe on-chain claim/reclaim and real sender-to-recipient flow before animation. Check the current repository first, preserve existing work, implement the smallest testable slice, and report verified tests, contract addresses and real transaction hashes. Do not implement bearer-link claims, fake gasless UX, admin drains, or shared Quilt payment code as a substitute for Wink's gift lifecycle.

**Related:** [`PRD.md`](./PRD.md), [`TRD.md`](./TRD.md), [`architecture.md`](./architecture.md).
