# Low risk strategy contracts

[`Strategy description`](https://docs.bolide.fi/protocol/strategies/low-risk-strategy "Description")

## For testing
0. Install Truffle and Ganache

1. Run the `npm i`
2. Run the `truffle compile` command to compile the smart contracts
3. Run the `truffle test test`


## Logic.sol error codes:
- E1 - Cannot accept
- E2 - vTokens is not used
- E3 - swap is not used
- E4 - swapMaster is not used
- E5 - vToken is not used
- E6 - blid was set
- E7 - storage was set


## StorageV0.sol error codes:
- E1 - token is not used
- E2 - is not logicContract
- E3 - Amount need more than zero
- E4 - withdraw amount exceeds balance
- E5 - contracrt hasn't enough for interest fee, please contact the administrator
- E6 - token was added
- E7 - iterate more than you can iterate
