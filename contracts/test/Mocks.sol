// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IWinkGiftVault {
    function claim(uint256 giftId) external;
}

/// @notice Helper that always reverts on native transfers.
contract RevertingRecipient {
    error AlwaysReverts();

    function claimGift(address vault, uint256 giftId) external {
        IWinkGiftVault(vault).claim(giftId);
    }

    receive() external payable {
        revert AlwaysReverts();
    }
}

/// @notice Helper that attempts to reenter claim() exactly once.
contract ReentrantClaimer {
    IWinkGiftVault public vault;
    uint256 public giftId;
    bool public attackEnabled = true;
    bool private _entered;

    constructor(address vault_) {
        vault = IWinkGiftVault(vault_);
    }

    function setGift(uint256 id_) external {
        giftId = id_;
    }

    function disableAttack() external {
        attackEnabled = false;
    }

    function attack() external {
        vault.claim(giftId);
    }

    receive() external payable {
        if (attackEnabled && !_entered) {
            _entered = true;
            vault.claim(giftId);
        }
    }
}
