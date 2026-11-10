// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title WinkGiftVault
/// @notice Native-BOT gift vault. Sender funds a gift, designated recipient
/// claims before expiry, otherwise the sender reclaims after expiry.
/// @dev Storage is authoritative. No admin withdrawal, no proxy, no fees,
/// no secret-based claims. Follows checks-effects-interactions and all
/// value transfers use checked low-level calls guarded by nonReentrant.
contract WinkGiftVault is ReentrancyGuard {
    enum GiftState {
        Unset,
        Funded,
        Claimed,
        Reclaimed
    }

    struct Gift {
        address sender;
        address recipient;
        uint256 amount;
        uint64 expiresAt;
        bytes32 metadataHash;
        GiftState state;
    }

    /// Minimum gift lifetime: 1 hour.
    uint256 public constant MIN_DURATION = 1 hours;
    /// Maximum gift lifetime: 30 days.
    uint256 public constant MAX_DURATION = 30 days;

    uint256 private _nextGiftId;
    mapping(uint256 => Gift) private _gifts;

    event GiftCreated(
        uint256 indexed giftId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint64 expiresAt,
        bytes32 metadataHash
    );
    event GiftClaimed(uint256 indexed giftId, address indexed recipient, uint256 amount);
    event GiftReclaimed(uint256 indexed giftId, address indexed sender, uint256 amount);

    error ZeroAmount();
    error ZeroRecipient();
    error SelfGift();
    error ExpiryTooSoon(uint64 expiresAt, uint64 minAllowed);
    error ExpiryTooFar(uint64 expiresAt, uint64 maxAllowed);
    error UnknownGift(uint256 giftId);
    error NotFunded(uint256 giftId);
    error NotRecipient(address caller, address recipient);
    error NotSender(address caller, address sender);
    error TooLate(uint256 giftId, uint256 nowTs, uint64 expiresAt);
    error TooEarly(uint256 giftId, uint256 nowTs, uint64 expiresAt);
    error TransferFailed(address to, uint256 amount);
    error DirectTransfersNotAllowed();

    /// @notice Number of gifts created so far. Also the next gift ID.
    function giftCount() external view returns (uint256) {
        return _nextGiftId;
    }

    /// @notice Fetch a gift by ID. Reverts for IDs never created.
    function getGift(uint256 giftId) external view returns (Gift memory) {
        if (giftId >= _nextGiftId) revert UnknownGift(giftId);
        return _gifts[giftId];
    }

    /// @notice Fund a gift for `recipient` that expires at `expiresAt`.
    /// @param recipient Designated claimer. Must not be zero or the sender.
    /// @param expiresAt Unix timestamp, must be within [now+1h, now+30d].
    /// @param metadataHash keccak256 of the public gift metadata (theme/message).
    /// @return giftId Monotonically increasing gift identifier.
    function createGift(
        address recipient,
        uint64 expiresAt,
        bytes32 metadataHash
    ) external payable returns (uint256 giftId) {
        if (msg.value == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroRecipient();
        if (recipient == msg.sender) revert SelfGift();

        uint256 minAllowed = block.timestamp + MIN_DURATION;
        uint256 maxAllowed = block.timestamp + MAX_DURATION;
        if (uint256(expiresAt) < minAllowed) revert ExpiryTooSoon(expiresAt, uint64(minAllowed));
        if (uint256(expiresAt) > maxAllowed) revert ExpiryTooFar(expiresAt, uint64(maxAllowed));

        giftId = _nextGiftId;
        _nextGiftId = giftId + 1;

        _gifts[giftId] = Gift({
            sender: msg.sender,
            recipient: recipient,
            amount: msg.value,
            expiresAt: expiresAt,
            metadataHash: metadataHash,
            state: GiftState.Funded
        });

        emit GiftCreated(giftId, msg.sender, recipient, msg.value, expiresAt, metadataHash);
    }

    /// @notice Claim a funded gift as the designated recipient before expiry.
    /// @dev Sets terminal state before the external call (checks-effects-interactions).
    function claim(uint256 giftId) external nonReentrant {
        if (giftId >= _nextGiftId) revert UnknownGift(giftId);
        Gift storage g = _gifts[giftId];
        if (g.state != GiftState.Funded) revert NotFunded(giftId);
        if (msg.sender != g.recipient) revert NotRecipient(msg.sender, g.recipient);
        if (block.timestamp >= uint256(g.expiresAt)) {
            revert TooLate(giftId, block.timestamp, g.expiresAt);
        }

        g.state = GiftState.Claimed;

        uint256 amount = g.amount;
        address recipient = g.recipient;
        (bool ok, ) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed(recipient, amount);

        emit GiftClaimed(giftId, recipient, amount);
    }

    /// @notice Reclaim a funded gift as the original sender at or after expiry.
    /// @dev Sets terminal state before the external call (checks-effects-interactions).
    function reclaim(uint256 giftId) external nonReentrant {
        if (giftId >= _nextGiftId) revert UnknownGift(giftId);
        Gift storage g = _gifts[giftId];
        if (g.state != GiftState.Funded) revert NotFunded(giftId);
        if (msg.sender != g.sender) revert NotSender(msg.sender, g.sender);
        if (block.timestamp < uint256(g.expiresAt)) {
            revert TooEarly(giftId, block.timestamp, g.expiresAt);
        }

        g.state = GiftState.Reclaimed;

        uint256 amount = g.amount;
        address sender = g.sender;
        (bool ok, ) = sender.call{value: amount}("");
        if (!ok) revert TransferFailed(sender, amount);

        emit GiftReclaimed(giftId, sender, amount);
    }

    /// @dev Reject direct native transfers so stray BOT cannot be mistaken for gifts.
    receive() external payable {
        revert DirectTransfersNotAllowed();
    }

    /// @dev Reject direct calls with value for the same reason.
    fallback() external payable {
        revert DirectTransfersNotAllowed();
    }
}
