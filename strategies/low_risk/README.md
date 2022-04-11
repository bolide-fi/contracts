# Low risk strategy contracts

## [`How strategy does work`](https://docs.bolide.fi/protocol/strategies/low-risk-strategy "Description")

---
## [👷‍♂️ Tech Requirements](../../README.md#👷‍♂️-tech-requirements)

---
## How to run tests:
- Run the `npm i`
- Run the `truffle compile` command to compile the smart contracts
- Run the `truffle test test`
---
## 📄 Description:

One strategy includes two contracts: __Logic__ and __Storage__.

### __Logic.sol__
Provides manage depositors tokens ability to admin (oracle) strategy

#### Error codes:
- E1 - Cannot accept
- E2 - vTokens is not used
- E3 - swap is not used
- E4 - swapMaster is not used
- E5 - vToken is not used
- E6 - blid is already set
- E7 - storage is already set

### __StorageV0.sol__

This contract is upgradable. Interacts with users, distributes earned BLID, and associates with Logic contract.

#### Error codes:
- E1 - token is not used
- E2 - is not logicContract
- E3 - need more amount need than zero
- E4 - withdraw amount exceeds balance
- E5 - contracrt hasn't enough for interest fee, please contact the administrator
- E6 - token is already added
- E7 - iterate more than you can iterate
