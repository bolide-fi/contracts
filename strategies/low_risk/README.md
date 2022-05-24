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

### __Storage.sol__

This contract is upgradable. Interacts with users, distributes earned BLID, and associates with Logic contract.

#### Error codes:
- E1 - token is not used
- E2 - is not logicContract
- E3 - need more amount need than zero
- E4 - withdraw amount exceeds balance
- E5 - contracrt hasn't enough for interest fee, please contact the administrator
- E6 - token is already added
- E7 - You can call updateAccumulatedRewardsPerShare one time for token

---
## Contracts Interaction architecture

![image info](./diagram.jpg "Interactions")
---
## BLID distribution model
Bolide Low risk Strategy distribute all earned income once X hours (often it is about 6 times a day). Users can deposit their assets and withdraw at any moment regardless of distribution schedule. To support it Bolide’s strategies use following algorithm

Let’s say we have:

- User 1 (U1) at time moment 1 (T1) deposited 2 USD (A1)
- User 2 (U2) at moment  2 (T2) deposited 2 USD (A2)
- The strategy made rewards distribution at moment 3 (t3) with 1 BLID distribution (B1)

The goal is to make an honest distribution 1 BLID between 2 users, the amounts of rewards should depend on the time before distribution and amount of users deposit.

Let's say “Dollar Time” means the amount of deposit multiplied to the time between deposit and distribution

$$\footnotesize DollarTime(u) = A(U) * \bigtriangleup T$$

For example
$$\footnotesize DollarTime(U_1) = A(U) * ΔT = A_1 * (T_3 - T_1) = A_1 * T_3 - A_1 * T_1 = 2 * 3 - 2 * 1 = 4$$

$$\footnotesize DollarTime(U_2) = A(U) * ΔT = A_2 * (T_3 - T_2) = A_2 * T_3 - A_2 * T_2 = 2 * 3 - 2 * 2 = 2$$

Then “Total Dollar time“

$$\footnotesize TotalDollarTime(U) = \sum_{n}^{1}DollarTime(Ui)$$

Then “Dollar Time Distribution” means how much BLID should be distributed per 1 DollarTime.

$$\footnotesize DollarTimeDistribution(U) = \frac{B}{TotalDollarTime}$$

For our example

$$\footnotesize DollarTimeDistribution(T_3) = \frac{1}{(2+4)} = \frac{1}{6}$$

Or we can calculate DollarTimeDistribution as follows 

$$\footnotesize DollarTimeDistribution(T) = \frac{B}{\sum_iAi*T-\sum_iAi*Ti}$$

Then

$$\footnotesize DollarTimeDistribution(T_3) = \frac{B_1}{(A_1 * T_3 + A_2 * T_3) - (A_1 * T_1 + A_2 * T_2)} = \frac{1}{4 * 3 - (2 * 1  + 2 * 2)} = \frac{1}{6}$$

After that, we can calculate user’s rewards as follows

$$\footnotesize Rewards(U_i) = DollarTimeDistribution(T) * DollarTime(U_i) = DollarTimeDistribution(T) * (A_i * T_d - A_i * T_i)$$

So we have 

$$\footnotesize Rewards(U_1) = \frac{1}{6} * (2 * 3 - 2 * 1) = \frac{2}{3}$$

$$\footnotesize Rewards(U_2) = \frac{1}{6} * (2 * 3 - 2 * 2) = \frac{1}{3}$$

It's obvious that if user withdraw some amount of deposit than we should use Ai with “-” sign in all calculations.

So the final formula is 

$$\footnotesize Rewards(U) = DollarTimeDistribution(T) * (A_i * T_d - A_i * T_i)$$