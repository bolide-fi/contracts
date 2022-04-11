# Private Sale contracts

## [👷‍♂️ Tech Requirements](../README.md#👷‍♂️-tech-requirements)

---
## How to run tests:
- Run the `npm i`
- Run the `truffle compile` command to compile the smart contracts
- Run the `truffle test test`
---
## 📄 Description:

Can create rounds in which investors can buy tokens receiving them by vesting
### Methods:
- __deposit__ - Deposit `amount` of `token` for buy BLID.
- __returnDeposit__ - Returns a deposit for the  `round`
- __addToken__ - Add token and token's oracle
- __newRound__ - Create new round. Parameters [InputNewRound](#inputnewround)
- __finishRound__ - Finish round
- __cancelRound__ - Cancel round
- __getRoundStateInfromation__ - Return  [InputNewRound](Description.md#reserveliquidity)
- __getLockedTokens__ - Returns Locked Tokens
- __getRoundDynamicInfromation__ - Returns (all deposited money, sold tokens, open or close round)
- __isInWhiteList__ - Return true if `account` is in white list
- __getInvestorWallet__ - Return Investor Wallet
- __isCancelled__ - Return true if `id` round is cancelled
- __isParticipatedInTheRound__ - Return true if `msg.sender` is Participated In The Round
- __getUserToken__ - Return deposited token address of `msg.sender`
- __isFinished__ - Return true if `id` round is finished

### __Structs__
#### InputNewRound
|Name| Type | text |
|---|---|---|
| _tokenRate  | uint256  |BLID/USD if type round 1, 0 if  type round 2|
| _maxMoney  | uint256 |Amount USD when close round|
| _sumTokens  | uint256  |Amount of selling BLID. Necessarily with the type of round 2 |
| _startTimestamp  |  uint256 | Unix timestamp  Start Round  | 
|  _endTimestamp |  uint256 | Unix timestamp  End Round    | 
|  _minimumSaleAmount |  uint256 |minimum sale amount  | 
|  _maximumSaleAmount |  uint256 |maximum sale amount  | 
|  _duration |  uint256 | Vesting duration period | 
|  _durationCount |  uint256 | Count of Vesting duration period | 
|  _lockup |  uint256 | duration from end round to start vesting | 
|  _typeRound |  uint8 |  if 1 rate set, if 2 dynamic rate, if 0 canceled round  | 
|  _percentOnInvestorWallet |  uint8 |  percent OnI nvestor Wallet | 
|  _burnable |  bool | if true then `_sumTokens`-selled blid burn  | 
|  _open |  bool | if false only  account from white list can deposit  | 
```
 struct InputNewRound{
        uint256 _tokenRate;
        uint256 _maxMoney;
        uint256 _sumTokens;
        uint256 _startTimestamp;
        uint256 _endTimestamp;
        uint256 _minimumSaleAmount;
        uint256 _maximumSaleAmount;
        uint256 _duration;
        uint256 _durationCount;
        uint256 _lockup;
        uint8 _typeRound;
        uint8 _percentOnInvestorWallet;
        bool _burnable;
        bool _open;
    }
```
