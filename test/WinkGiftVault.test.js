const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const ONE_HOUR = 3600;
const THIRTY_DAYS = 30 * 24 * 3600;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function deployVault() {
  const Factory = await ethers.getContractFactory("WinkGiftVault");
  const vault = await Factory.deploy();
  await vault.waitForDeployment();
  return vault;
}

async function latestPlus(seconds) {
  return (await time.latest()) + seconds;
}

describe("WinkGiftVault", function () {
  it("starts empty", async function () {
    const vault = await deployVault();
    expect(await vault.giftCount()).to.equal(0);
  });

  it("creates a gift with event and stored fields", async function () {
    const vault = await deployVault();
    const [sender, recipient] = await ethers.getSigners();
    const expiresAt = await latestPlus(2 * ONE_HOUR);
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("wink-gift-1"));
    const amount = ethers.parseEther("1.5");

    await expect(vault.connect(sender).createGift(recipient.address, expiresAt, metadataHash, { value: amount }))
      .to.emit(vault, "GiftCreated")
      .withArgs(0, sender.address, recipient.address, amount, expiresAt, metadataHash);

    expect(await vault.giftCount()).to.equal(1);
    const g = await vault.getGift(0);
    expect(g.sender).to.equal(sender.address);
    expect(g.recipient).to.equal(recipient.address);
    expect(g.amount).to.equal(amount);
    expect(g.expiresAt).to.equal(expiresAt);
    expect(g.metadataHash).to.equal(metadataHash);
    expect(g.state).to.equal(1); // Funded
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(amount);
  });

  it("rejects zero amount, zero recipient and self-gifting", async function () {
    const vault = await deployVault();
    const [sender, recipient] = await ethers.getSigners();
    const ok = await latestPlus(2 * ONE_HOUR);
    const hash = ethers.ZeroHash;

    await expect(
      vault.connect(sender).createGift(recipient.address, ok, hash, { value: 0 })
    ).to.be.revertedWithCustomError(vault, "ZeroAmount");

    await expect(
      vault.connect(sender).createGift(ethers.ZeroAddress, ok, hash, { value: 100 })
    ).to.be.revertedWithCustomError(vault, "ZeroRecipient");

    await expect(
      vault.connect(sender).createGift(sender.address, ok, hash, { value: 100 })
    ).to.be.revertedWithCustomError(vault, "SelfGift");
  });

  it("rejects expiries outside 1 hour to 30 days", async function () {
    const vault = await deployVault();
    const [sender, recipient] = await ethers.getSigners();
    const now = await time.latest();
    const hash = ethers.ZeroHash;
    const amount = 1000;

    await expect(
      vault.connect(sender).createGift(recipient.address, now + ONE_HOUR - 1, hash, { value: amount })
    ).to.be.revertedWithCustomError(vault, "ExpiryTooSoon");

    await expect(
      vault.connect(sender).createGift(recipient.address, now + THIRTY_DAYS + 60, hash, { value: amount })
    ).to.be.revertedWithCustomError(vault, "ExpiryTooFar");

    // Lower and upper edges are accepted.
    await expect(
      vault.connect(sender).createGift(recipient.address, (await latestPlus(ONE_HOUR + 1)), hash, {
        value: amount,
      })
    ).to.emit(vault, "GiftCreated");
    await expect(
      vault.connect(sender).createGift(recipient.address, (await latestPlus(THIRTY_DAYS - 5)), hash, {
        value: amount,
      })
    ).to.emit(vault, "GiftCreated");
  });

  it("reverts on unknown gift IDs", async function () {
    const vault = await deployVault();
    const [sender] = await ethers.getSigners();
    await expect(vault.getGift(999)).to.be.revertedWithCustomError(vault, "UnknownGift");
    await expect(vault.connect(sender).claim(999)).to.be.revertedWithCustomError(vault, "UnknownGift");
    await expect(vault.connect(sender).reclaim(999)).to.be.revertedWithCustomError(vault, "UnknownGift");
  });

  it("only the recipient can claim before expiry; only the sender can reclaim after", async function () {
    const vault = await deployVault();
    const [sender, recipient, stranger] = await ethers.getSigners();
    const expiresAt = await latestPlus(2 * ONE_HOUR);
    await vault.connect(sender).createGift(recipient.address, expiresAt, ethers.ZeroHash, { value: 500 });

    await expect(vault.connect(stranger).claim(0)).to.be.revertedWithCustomError(vault, "NotRecipient");
    await expect(vault.connect(sender).claim(0)).to.be.revertedWithCustomError(vault, "NotRecipient");
    await expect(vault.connect(recipient).reclaim(0)).to.be.revertedWithCustomError(vault, "NotSender");
    await expect(vault.connect(stranger).reclaim(0)).to.be.revertedWithCustomError(vault, "NotSender");
    // Premature reclaim by the sender fails.
    await expect(vault.connect(sender).reclaim(0)).to.be.revertedWithCustomError(vault, "TooEarly");
  });

  it("enforces exact expiry boundaries", async function () {
    const vault = await deployVault();
    const [sender, recipient] = await ethers.getSigners();

    // Claim must succeed at expiresAt - 1.
    const exp1 = await latestPlus(2 * ONE_HOUR);
    await vault.connect(sender).createGift(recipient.address, exp1, ethers.ZeroHash, { value: 100 });
    await time.setNextBlockTimestamp(exp1 - 1);
    await expect(vault.connect(recipient).claim(0)).to.emit(vault, "GiftClaimed");

    // Claim at exactly expiresAt is too late; reclaim at exactly expiresAt works.
    const exp2 = (await time.latest()) + 2 * ONE_HOUR;
    await vault.connect(sender).createGift(recipient.address, exp2, ethers.ZeroHash, { value: 200 });
    await time.setNextBlockTimestamp(exp2);
    await expect(vault.connect(recipient).claim(1)).to.be.revertedWithCustomError(vault, "TooLate");
    await expect(vault.connect(sender).reclaim(1)).to.emit(vault, "GiftReclaimed");
  });

  it("claim pays the exact amount and flips state", async function () {
    const vault = await deployVault();
    const [sender, recipient] = await ethers.getSigners();
    const amount = ethers.parseEther("0.25");
    const expiresAt = await latestPlus(2 * ONE_HOUR);
    await vault.connect(sender).createGift(recipient.address, expiresAt, ethers.ZeroHash, { value: amount });

    const before = await ethers.provider.getBalance(recipient.address);
    const tx = await vault.connect(recipient).claim(0);
    const receipt = await tx.wait();
    const gas = receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(recipient.address);
    expect(after - before + gas).to.equal(amount);

    const g = await vault.getGift(0);
    expect(g.state).to.equal(2); // Claimed
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0);
  });

  it("reclaim pays the exact amount back to the sender", async function () {
    const vault = await deployVault();
    const [sender, recipient] = await ethers.getSigners();
    const amount = ethers.parseEther("0.4");
    const expiresAt = await latestPlus(2 * ONE_HOUR);
    await vault.connect(sender).createGift(recipient.address, expiresAt, ethers.ZeroHash, { value: amount });

    await time.increaseTo(expiresAt + 1);
    const before = await ethers.provider.getBalance(sender.address);
    const tx = await vault.connect(sender).reclaim(0);
    const receipt = await tx.wait();
    const gas = receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(sender.address);
    expect(after - before + gas).to.equal(amount);

    const g = await vault.getGift(0);
    expect(g.state).to.equal(3); // Reclaimed
  });

  it("prevents every double withdrawal path", async function () {
    const vault = await deployVault();
    const [sender, recipient] = await ethers.getSigners();

    const e1 = await latestPlus(2 * ONE_HOUR);
    await vault.connect(sender).createGift(recipient.address, e1, ethers.ZeroHash, { value: 100 });
    await vault.connect(recipient).claim(0);
    await expect(vault.connect(recipient).claim(0)).to.be.revertedWithCustomError(vault, "NotFunded");
    await expect(vault.connect(sender).reclaim(0)).to.be.revertedWithCustomError(vault, "NotFunded");

    const e2 = (await time.latest()) + 2 * ONE_HOUR;
    await vault.connect(sender).createGift(recipient.address, e2, ethers.ZeroHash, { value: 100 });
    await time.increaseTo(e2 + 1);
    await vault.connect(sender).reclaim(1);
    await expect(vault.connect(sender).reclaim(1)).to.be.revertedWithCustomError(vault, "NotFunded");
    await expect(vault.connect(recipient).claim(1)).to.be.revertedWithCustomError(vault, "NotFunded");
  });

  it("expired gifts cannot be claimed", async function () {
    const vault = await deployVault();
    const [sender, recipient] = await ethers.getSigners();
    const expiresAt = await latestPlus(2 * ONE_HOUR);
    await vault.connect(sender).createGift(recipient.address, expiresAt, ethers.ZeroHash, { value: 100 });
    await time.increaseTo(expiresAt + 3600);
    await expect(vault.connect(recipient).claim(0)).to.be.revertedWithCustomError(vault, "TooLate");
  });

  it("reverts when the recipient contract rejects payment and keeps funds locked", async function () {
    const vault = await deployVault();
    const [sender] = await ethers.getSigners();
    const Reverting = await ethers.getContractFactory("RevertingRecipient");
    const bad = await Reverting.deploy();
    await bad.waitForDeployment();

    const expiresAt = await latestPlus(2 * ONE_HOUR);
    await vault.connect(sender).createGift(await bad.getAddress(), expiresAt, ethers.ZeroHash, {
      value: 1000,
    });
    await expect(bad.claimGift(await vault.getAddress(), 0)).to.be.reverted;

    const g = await vault.getGift(0);
    expect(g.state).to.equal(1);
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(1000);
  });

  it("survives a reentrancy attempt and pays exactly once", async function () {
    const vault = await deployVault();
    const [sender] = await ethers.getSigners();
    const Attacker = await ethers.getContractFactory("ReentrantClaimer");
    const attacker = await Attacker.deploy(await vault.getAddress());
    await attacker.waitForDeployment();
    await attacker.setGift(0);

    const expiresAt = await latestPlus(2 * ONE_HOUR);
    await vault.connect(sender).createGift(await attacker.getAddress(), expiresAt, ethers.ZeroHash, {
      value: ethers.parseEther("1"),
    });

    // Reentrant claim reverts; no funds move and the gift stays funded.
    await expect(attacker.attack()).to.be.reverted;
    expect((await vault.getGift(0)).state).to.equal(1);
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(ethers.parseEther("1"));

    // Honest claim works exactly once afterwards.
    await attacker.disableAttack();
    await expect(attacker.attack()).to.emit(vault, "GiftClaimed");
    expect((await vault.getGift(0)).state).to.equal(2);
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0);
    await expect(attacker.attack()).to.be.revertedWithCustomError(vault, "NotFunded");
  });

  it("rejects direct native transfers", async function () {
    const vault = await deployVault();
    const [sender] = await ethers.getSigners();
    await expect(
      sender.sendTransaction({ to: await vault.getAddress(), value: 100 })
    ).to.be.revertedWithCustomError(vault, "DirectTransfersNotAllowed");
  });

  it("keeps independent gifts isolated and conserves balance", async function () {
    const vault = await deployVault();
    const [sender, alice, bob] = await ethers.getSigners();
    const e1 = await latestPlus(2 * ONE_HOUR);
    const e2 = (await time.latest()) + 3 * ONE_HOUR;
    const e3 = (await time.latest()) + 4 * ONE_HOUR;

    await vault.connect(sender).createGift(alice.address, e1, ethers.id("a"), { value: 100 });
    await vault.connect(sender).createGift(bob.address, e2, ethers.id("b"), { value: 200 });
    await vault.connect(sender).createGift(alice.address, e3, ethers.id("c"), { value: 300 });
    expect(await vault.giftCount()).to.equal(3);

    await vault.connect(alice).claim(0);
    await time.increaseTo(e2 + 1);
    await vault.connect(sender).reclaim(1);

    // Gift 2 untouched; contract holds exactly its amount.
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(300);
    const g2 = await vault.getGift(2);
    expect(g2.state).to.equal(1);
    expect(g2.amount).to.equal(300);

    // Total paid out (100 + 200) plus locked (300) equals total funded (600).
    expect((await vault.getGift(0)).state).to.equal(2);
    expect((await vault.getGift(1)).state).to.equal(3);
  });

  it("fuzzes gift creation over amounts, expiries and hashes", async function () {
    const vault = await deployVault();
    const signers = await ethers.getSigners();
    const rand = mulberry32(12345);
    const N = 30;
    let expectedBalance = 0n;
    let rejected = 0;

    for (let i = 0; i < N; i++) {
      const sender = signers[i % signers.length];
      const recipient = signers[(i + 1) % signers.length];
      const amount = 1n + BigInt(Math.floor(rand() * 1_000_000_000_000_000)) + 1n;
      const span = Math.floor(rand() * (THIRTY_DAYS - ONE_HOUR)) + ONE_HOUR;
      const now = await time.latest();
      const valid = rand() > 0.3;
      const expiresAt = valid ? now + span : now + (rand() > 0.5 ? 60 : THIRTY_DAYS + 3600);
      const hash = ethers.keccak256(ethers.toUtf8Bytes(`fuzz-${i}`));

      if (recipient.address === sender.address || !valid) {
        await expect(
          vault.connect(sender).createGift(recipient.address, expiresAt, hash, { value: amount })
        ).to.be.reverted;
        rejected++;
        continue;
      }
      const id = await vault.giftCount();
      await expect(vault.connect(sender).createGift(recipient.address, expiresAt, hash, { value: amount }))
        .to.emit(vault, "GiftCreated")
        .withArgs(id, sender.address, recipient.address, amount, expiresAt, hash);
      expectedBalance += amount;
    }

    expect(await vault.giftCount()).to.equal(BigInt(N - rejected));
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(expectedBalance);
  });

  it("emits claim and reclaim events with exact values", async function () {
    const vault = await deployVault();
    const [sender, recipient] = await ethers.getSigners();

    const e1 = await latestPlus(2 * ONE_HOUR);
    await vault.connect(sender).createGift(recipient.address, e1, ethers.ZeroHash, { value: 777 });
    await expect(vault.connect(recipient).claim(0))
      .to.emit(vault, "GiftClaimed")
      .withArgs(0, recipient.address, 777);

    const e2 = (await time.latest()) + 2 * ONE_HOUR;
    await vault.connect(sender).createGift(recipient.address, e2, ethers.ZeroHash, { value: 888 });
    await time.increaseTo(e2 + 1);
    await expect(vault.connect(sender).reclaim(1))
      .to.emit(vault, "GiftReclaimed")
      .withArgs(1, sender.address, 888);
  });
});
