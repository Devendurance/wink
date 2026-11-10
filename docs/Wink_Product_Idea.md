---
title: "Wink product idea"
brand: "Wink"
descriptor: "Personal BOT gifting"
status: "Concept and target MVP, not a shipped implementation"
last_updated: "2026-11-09"
---

# Wink product idea

## Executive summary

**Wink** is a target independent DApp for BOT Chain. Wink turns a native BOT transfer into a personal, wallet-bound gift that the recipient can open and claim.

The product brief supports a narrow first release. It does not evidence a production deployment, completed mainnet journey, live user activity or shipped contract. The descriptions below separate the intended build from claims that can be made today.

- **Shipped:** No shipped capability is evidenced in the supplied brief.
- **Target:** The wallet-bound native-BOT gifting loop described in this document.
- **Roadmap:** Anonymous claims, gasless claims, wallet creation and additional asset types.
- **Hypothesis:** Real users will use Wink for repeat gifting, appreciation and onboarding.

## Product thesis

A normal crypto transfer is functional but emotionally flat. The recipient may see an unfamiliar transaction without knowing why it was sent or what to do next.

Wink gives a BOT transfer a sender, a message, a reveal and a recipient-bound claim.

## Why the product matters

Make digital value feel as intentional as the person sending it. It can give the BOT Chain ecosystem a concrete human use case that is easier to explain than protocol infrastructure alone.

This is a hypothesis until real users complete the intended action and return for a second use.

## Who it is for

- **Primary audience:** Friends and communities, creators and fans, and Web3 newcomers receiving a first small BOT gift.
- **Buyer or initiator:** The person who sets up, sends, tries or publishes the action.
- **User affected by the outcome:** Recipients, readers or collaborators who need to understand what happened.
- **Gatekeeper:** A wallet user who must approve the relevant transaction or authorization.
- **Secondary stakeholder:** BOT Chain ecosystem operators and judges evaluating the independent product.

## Category and alternatives

**Category:** Personal on-chain gifting and social value transfer

People may otherwise send a plain wallet transfer, use a gift card, write a message in a separate app or ask the recipient to interpret a raw transaction. Wink should explain its narrow advantage over those alternatives without pretending to replace them all.

## Core user journey

1. **Connect:** The sender connects a wallet and confirms BOT Chain mainnet.
2. **Personalize:** The sender chooses the recipient wallet, amount, note and expiry.
3. **Fund:** The sender reviews the details and funds the native-BOT gift.
4. **Reveal:** The sender shares the gift page with the recipient.
5. **Claim:** Only the nominated wallet can claim the gift after the recipient reviews the gas requirement.
6. **Reclaim:** After expiry, the sender can reclaim an unclaimed gift.

## Target first release

The first release should prove one complete causal loop rather than present a broad platform.

- **Target:** Wallet connection and BOT Chain mainnet handling.
- **Target:** The narrow product action described in the supplied brief.
- **Target:** Accurate pending, rejected, failed and confirmed states where the action involves a wallet transaction.
- **Target:** A public receipt, claim page or evidence page tied to the relevant chain reference.
- **Target:** Clear boundary language that explains what the proof does not establish.

## Deliberately out of scope for the first release

- **Roadmap:** Additional tokens, complex payment or gifting modes, broad account abstraction or wallet creation.
- **Roadmap:** Universal verification, automatic safety ratings, paid review incentives, arbitrary rankings or AI-generated summaries.
- **Roadmap:** Advanced administration, analytics, refunds, fiat settlement or a large marketplace.

The exact cut line for this product is defined in the corresponding seven-things scope file.

## On-chain boundary

The target GiftVault flow binds the gift to a recipient wallet, locks native BOT until claim, prevents a second claim and permits reclaim only after expiry. The source brief also requires clear explanation that the recipient needs BOT for gas.

The product should never imply that a transaction proves more than the contract or verification rule actually checks. Wallet confirmation, provider acknowledgement, claim, review registration and final outcome are separate states when the journey contains them.

## Trust and failure requirements

- Reject invalid inputs before a wallet signature whenever possible.
- Never label an unconfirmed transaction as complete.
- Preserve the state required for recovery before handing control to a wallet.
- Prevent duplicate actions where the contract or product promise requires one-time use.
- If the outcome is unknown, tell the user not to repeat the action until reconciliation finishes.
- Keep any secret-like data out of public copy, source examples and generated documents.

## Brand and experience idea

Wink is a small human signal. It makes a transfer feel personal without turning the product into a toy or tying it permanently to one token.

The product should feel warm, celebratory, playful and clear, never casino-like, childish or louder than the occasion. It achieves that through clear choices, visible boundaries, modest claims and a usable receipt. The brand should not add noise to compensate for an unfinished proof loop.

## Success evidence

The supplied brief identifies real-use targets for launch. These are not current results:

- One complete real product journey with a public usable interface.
- At least three independent wallets participating in the relevant actions.
- At least five valid product interactions or registrations within seven days, with the exact interpretation confirmed by the organizer where required.
- A working site, product-specific identity, BOT Chain attribution and operational support path.

## Open decisions before build

1. Confirm the exact contract addresses and deployment environment before the interface uses them.
2. Confirm the organizer's interpretation of qualifying interactions and any payment terms.
3. Confirm domain, social-handle, trademark, company-registry and multilingual name status for Wink.
4. Define the public evidence format and recovery behaviour before writing success copy.
5. Test the core loop with real users rather than treating a successful local transaction as adoption proof.

## Decisive recommendation

Build Wink as a narrow, inspectable product. Let the core human action lead the demo. Put BOT Chain in the proof layer and keep every target, roadmap item and hypothesis labelled until real execution supports a stronger claim.

## Sources


- User-supplied BOT Chain concept brief for the personal-gifting product, extracted from the supplied archive, pages 1-5.
- [BOT Chain developer quick guide](https://dev-docs.botchain.ai/docs/Developers/quick-guide/), used for the documented EVM context, mainnet Chain ID 677, native BOT and explorer reference.
- [BOT Chain ecosystem directory](https://botchain.ai/en/project-party/), used for the ecosystem frame of reference.
- [BOT Chain explorer](https://scan.botchain.ai/), named in the source brief as the public transaction reference.
- [Wink](https://www.wink.com.br/), consulted during preliminary name-collision screening. This check is not trademark or legal clearance.

