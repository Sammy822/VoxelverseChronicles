// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// A simple contract that allows the owner to withdraw funds after a certain time.
contract Lock {
    uint public unlockTime;
    address payable public owner;

    event Withdrawal(uint amount, uint when);

    constructor(uint _unlockTime) payable {
        require(
            block.timestamp < _unlockTime,
            "Unlock time should be in the future"
        );

        unlockTime = _unlockTime;
        owner = payable(msg.sender);
    }

    function withdraw() public {
        // Require that the current time is after the unlock time.
        require(block.timestamp >= unlockTime, "You can't withdraw yet");
        // Require that the caller is the owner.
        require(msg.sender == owner, "You aren't the owner");

        emit Withdrawal(address(this).balance, block.timestamp);

        owner.transfer(address(this).balance);
    }
}
