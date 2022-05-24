# Farming/Staking contracts

This contract was forked from [`that contract`](https://github.com/pancakeswap/pancake-farm/blob/a61313bf107c7f82e1a0f5736d815041fbf8cdff/contracts/MasterChef.sol "Origin")

---
## [👷‍♂️ Tech Requirements](../README.md#👷‍♂️-tech-requirements)

## Contracts Interaction architecture
**MasterBlid** is cointain business logic. This contrat is owned and managed with Timelock contract.

**Timelock** is need to do time delayed interactions with MasterBlid. There are few method to interact with the MasterBlid contact:
- queueTransaction
- cancelTransaction
- executeTransaction

---
## How to run tests:
- Run the `npm i`
- Run the `truffle compile` command to compile the smart contracts
- Run the `truffle test test`
