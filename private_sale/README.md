# Private Sale


## [Tech Requirements](../README.md#tech-requirements)


## How to run tests:
1. Run the `npm i `
2. Run the `truffle compile` command to compile the smart contracts
3. Run the `truffle test test`

### Mint settings
+ `day` is constant stores the number of seconds after which the token will be unlocked from the holder (by default equals exactly one day)
+ `allDay` is constant stores the number of `day` (exactly constant) where coins are unlocked
+ `countMintDay` is constant stores the number of `day` (exactly constant) where owner can use mint
+ Owner can use mint or mintArray(analogue mint for many address) 
+ The number of coins and their distribution is regulated by the owner of the contract during `countMintDay`
