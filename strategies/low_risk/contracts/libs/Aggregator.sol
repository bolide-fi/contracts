// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Aggregator {
    function decimals() external view returns (uint8) {
        return 8;
    }

    function latestAnswer() external view returns (int256 answer) {
        return 99997069;
    }
}

contract AggregatorN2 {
    function decimals() external view returns (uint8) {
        return 8;
    }

    function latestAnswer() external view returns (int256 answer) {
        return 99997069 * 2;
    }
}

contract AggregatorN3 {
    uint8 _decimals;
    int256 _latestAnswer;

    constructor() public {
        _decimals = 8;
        _latestAnswer = 100000000;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function latestAnswer() external view returns (int256 answer) {
        return _latestAnswer;
    }

    function updateRate(uint8 newDecimals, int256 newLatestAnswer) external {
        _decimals = newDecimals;
        _latestAnswer = newLatestAnswer;
    }
}
