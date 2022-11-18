// SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

interface IStorage {
    function takeToken(uint256 amount, address token) external;

    function returnToken(uint256 amount, address token) external;

    function addEarn(uint256 amount) external;

    function depositOnBehalf(
        uint256 amount,
        address token,
        address accountAddress
    ) external;
}
