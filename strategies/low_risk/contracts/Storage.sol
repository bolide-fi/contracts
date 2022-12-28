// SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface ILogicContract {
    function returnToken(uint256 amount, address token) external;
}

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestAnswer() external view returns (int256 answer);
}

contract StorageV21 is Initializable, OwnableUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    //struct
    struct DepositStruct {
        mapping(address => uint256) amount;
        mapping(address => int256) tokenTime;
        uint256 iterate;
        uint256 balanceBLID;
        mapping(address => uint256) depositIterate;
    }

    struct EarnBLID {
        uint256 allBLID;
        uint256 timestamp;
        uint256 usd;
        uint256 tdt;
        mapping(address => uint256) rates;
    }

    struct BoostInfo {
        uint256 blidDeposit;
        uint256 rewardDebt;
        uint256 blidOverDeposit;
    }

    /*** events ***/

    event Deposit(address depositor, address token, uint256 amount);
    event Withdraw(address depositor, address token, uint256 amount);
    event UpdateTokenBalance(uint256 balance, address token);
    event TakeToken(address token, uint256 amount);
    event ReturnToken(address token, uint256 amount);
    event AddEarn(uint256 amount);
    event UpdateBLIDBalance(uint256 balance);
    event InterestFee(address depositor, uint256 amount);
    event SetBLID(address blid);
    event AddToken(address token, address oracle);
    event SetLogic(address logic);
    event SetBoostInfo(uint256 maxBlidPerUSD, uint256 blidPerBlock);
    event DepositBLID(address depositor, uint256 amount);
    event WithdrawBLID(address depositor, uint256 amount);
    event ClaimBoostBLID(address depositor, uint256 amount);
    event SetBoostingAddress(address boostingAddress);
    event SetAdmin(address admin);
    event UpgradeVersion(string version, string purpose);

    function initialize(address _logicContract) external initializer {
        OwnableUpgradeable.__Ownable_init();
        PausableUpgradeable.__Pausable_init();
        logicContract = _logicContract;
    }

    mapping(uint256 => EarnBLID) private earnBLID;
    uint256 private countEarns;
    uint256 private countTokens;
    mapping(uint256 => address) private tokens;
    mapping(address => uint256) private tokenBalance;
    mapping(address => address) private oracles;
    mapping(address => bool) private tokensAdd;
    mapping(address => DepositStruct) private deposits;
    mapping(address => uint256) private tokenDeposited;
    mapping(address => int256) private tokenTime;
    uint256 private reserveBLID;
    address private logicContract;
    address private BLID;
    mapping(address => mapping(uint256 => uint256)) public accumulatedRewardsPerShare;

    // ****** Add from V21 ******

    // Boost2.0
    mapping(address => BoostInfo) private userBoosts;
    uint256 public maxBlidPerUSD;
    uint256 public blidPerBlock;
    uint256 public initBlidPerBlock;
    uint256 public accBlidPerShare;
    uint256 public lastRewardBlock;
    address public boostingAddress;

    /*** modifiers ***/

    modifier isUsedToken(address _token) {
        require(tokensAdd[_token], "E1");
        _;
    }

    modifier isLogicContract(address account) {
        require(logicContract == account, "E2");
        _;
    }

    /*** Owner functions ***/

    /**
     * @notice Set blid in contract
     * @param _blid address of BLID
     */
    function setBLID(address _blid) external onlyOwner {
        BLID = _blid;

        emit SetBLID(_blid);
    }

    /**
     * @notice Set blid in contract
     * @param _boostingAddress address of expense
     */
    function setBoostingAddress(address _boostingAddress) external onlyOwner {
        boostingAddress = _boostingAddress;

        emit SetBoostingAddress(boostingAddress);
    }

    /**
     * @notice Set boosting parameters
     * @param _maxBlidperUSD max value of BLID per USD
     * @param _blidperBlock blid per Block
     */
    function setBoostingInfo(uint256 _maxBlidperUSD, uint256 _blidperBlock) external onlyOwner {
        _boostingUpdateAccBlidPerShare();

        maxBlidPerUSD = _maxBlidperUSD;
        blidPerBlock = _blidperBlock;
        initBlidPerBlock = _blidperBlock;

        emit SetBoostInfo(_maxBlidperUSD, _blidperBlock);
    }

    /**
     * @notice Triggers stopped state.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Returns to normal state.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Update AccumulatedRewardsPerShare for token, using once after update contract
     * @param token Address of token
     */
    function updateAccumulatedRewardsPerShare(address token) external onlyOwner {
        require(accumulatedRewardsPerShare[token][0] == 0, "E7");
        uint256 countEarns_ = countEarns;
        for (uint256 i = 0; i < countEarns_; i++) {
            updateAccumulatedRewardsPerShareById(token, i);
        }
    }

    /**
     * @notice Add token and token's oracle
     * @param _token Address of Token
     * @param _oracles Address of token's oracle(https://docs.chain.link/docs/binance-smart-chain-addresses/
     */
    function addToken(address _token, address _oracles) external onlyOwner {
        require(_token != address(0) && _oracles != address(0));
        require(!tokensAdd[_token], "E6");
        oracles[_token] = _oracles;
        tokens[countTokens++] = _token;
        tokensAdd[_token] = true;

        emit AddToken(_token, _oracles);
    }

    /**
     * @notice Set logic in contract(only for upgradebale contract,use only whith DAO)
     * @param _logic Address of Logic Contract
     */
    function setLogic(address _logic) external onlyOwner {
        logicContract = _logic;

        emit SetLogic(_logic);
    }

    /*** User functions ***/

    /**
     * @notice Deposit amount of token for msg.sender
     * @param amount amount of token
     * @param token address of token
     */
    function deposit(uint256 amount, address token) external payable isUsedToken(token) whenNotPaused {
        depositInternal(amount, token, msg.sender);
    }

    /**
     * @notice Deposit amount of token on behalf of depositor wallet
     * @param amount amount of token
     * @param token address of token
     * @param accountAddress Address of depositor
     */
    function depositOnBehalf(
        uint256 amount,
        address token,
        address accountAddress
    ) external payable isUsedToken(token) whenNotPaused {
        depositInternal(amount, token, accountAddress);
    }

    /**
     * @notice Withdraw amount of token  from Strategy and receiving earned tokens.
     * @param amount Amount of token
     * @param token Address of token
     */
    function withdraw(uint256 amount, address token) external isUsedToken(token) whenNotPaused {
        uint8 decimals = AggregatorV3Interface(token).decimals();
        uint256 countEarns_ = countEarns;
        uint256 amountExp18 = amount * 10**(18 - decimals);
        DepositStruct storage depositor = deposits[msg.sender];
        require(depositor.amount[token] >= amountExp18 && amount > 0, "E4");
        if (amountExp18 > tokenBalance[token]) {
            ILogicContract(logicContract).returnToken(amount, token);
            interestFee(msg.sender);
            IERC20Upgradeable(token).safeTransferFrom(logicContract, msg.sender, amount);
            tokenDeposited[token] -= amountExp18;
            tokenTime[token] -= int256(block.timestamp * (amountExp18));
        } else {
            interestFee(msg.sender);
            IERC20Upgradeable(token).safeTransfer(msg.sender, amount);
            tokenTime[token] -= int256(block.timestamp * (amountExp18));

            tokenBalance[token] -= amountExp18;
            tokenDeposited[token] -= amountExp18;
        }
        if (depositor.depositIterate[token] == countEarns_) {
            depositor.tokenTime[token] -= int256(block.timestamp * (amountExp18));
        } else {
            depositor.tokenTime[token] =
                int256(depositor.amount[token] * earnBLID[countEarns_ - 1].timestamp) -
                int256(block.timestamp * (amountExp18));
            depositor.depositIterate[token] = countEarns_;
        }
        depositor.amount[token] -= amountExp18;

        // Claim BoostingRewardBLID
        _claimBoostingRewardBLIDInternal(msg.sender, true);

        emit UpdateTokenBalance(tokenBalance[token], token);
        emit Withdraw(msg.sender, token, amountExp18);
    }

    /**
     * @notice Claim BLID to accountAddress
     * @param accountAddress account address for claim
     */
    function interestFee(address accountAddress) public {
        uint256 balanceUser = balanceEarnBLID(accountAddress);
        require(reserveBLID >= balanceUser, "E5");
        IERC20Upgradeable(BLID).safeTransfer(accountAddress, balanceUser);
        DepositStruct storage depositor = deposits[accountAddress];
        depositor.balanceBLID = balanceUser;
        depositor.iterate = countEarns;
        //unchecked is used because a check was made in require
        unchecked {
            depositor.balanceBLID = 0;
            reserveBLID -= balanceUser;
        }

        emit UpdateBLIDBalance(reserveBLID);
        emit InterestFee(accountAddress, balanceUser);
    }

    /*** Boosting User function ***/

    /**
     * @notice Deposit BLID token for boosting.
     * @param amount amount of token
     */
    function depositBLID(uint256 amount) external whenNotPaused {
        require(amount > 0, "E3");
        uint256 usdDepositAmount = balanceOf(msg.sender);
        require(usdDepositAmount > 0, "E11");

        BoostInfo storage userBoost = userBoosts[msg.sender];

        _claimBoostingRewardBLIDInternal(msg.sender, false);
        IERC20Upgradeable(BLID).safeTransferFrom(msg.sender, address(this), amount);

        // Adjust blidOverDeposit
        uint256 totalAmount = userBoost.blidDeposit + amount;
        uint256 blidDepositLimit = (usdDepositAmount * maxBlidPerUSD) / 1e18;
        uint256 depositAmount = amount;
        if (totalAmount > blidDepositLimit) {
            uint256 overAmount = totalAmount - blidDepositLimit;
            userBoost.blidOverDeposit += overAmount;
            depositAmount = amount - overAmount;
        }

        userBoost.blidDeposit += depositAmount;

        // Save rewardDebt
        userBoost.rewardDebt = (userBoost.blidDeposit * accBlidPerShare) / 1e18;

        emit DepositBLID(msg.sender, amount);
    }

    /**
     * @notice WithDraw BLID token for boosting.
     * @param amount amount of token
     */
    function withdrawBLID(uint256 amount) external whenNotPaused {
        require(amount > 0, "E3");
        BoostInfo storage userBoost = userBoosts[msg.sender];
        uint256 usdDepositAmount = balanceOf(msg.sender);
        require(amount <= userBoost.blidDeposit + userBoost.blidOverDeposit, "E12");

        _claimBoostingRewardBLIDInternal(msg.sender, false);
        IERC20Upgradeable(BLID).safeTransfer(msg.sender, amount);

        // Adjust blidOverDeposit
        uint256 oldBlidDeposit = userBoost.blidDeposit;
        uint256 totalAmount = oldBlidDeposit + userBoost.blidOverDeposit - amount;
        uint256 blidDepositLimit = (usdDepositAmount * maxBlidPerUSD) / 1e18;
        if (totalAmount > blidDepositLimit) {
            userBoost.blidDeposit = blidDepositLimit;
            userBoost.blidOverDeposit = totalAmount - blidDepositLimit;
        } else {
            userBoost.blidDeposit = totalAmount;
            userBoost.blidOverDeposit = 0;
        }

        // Save rewardDebt
        userBoost.rewardDebt = (userBoost.blidDeposit * accBlidPerShare) / 1e18;

        emit WithdrawBLID(msg.sender, amount);
    }

    /**
     * @notice Claim Boosting Reward BLID to msg.sender
     */
    function claimBoostingRewardBLID() external {
        _claimBoostingRewardBLIDInternal(msg.sender, true);
    }

    /**
     * @notice get deposited Boosting BLID amount of user
     * @param _user address of user
     */
    function getBoostingBLIDAmount(address _user) public view returns (uint256) {
        BoostInfo storage userBoost = userBoosts[_user];
        uint256 amount = userBoost.blidDeposit + userBoost.blidOverDeposit;
        return amount;
    }

    /*** LogicContract function ***/

    /**
     * @notice Transfer amount of token from Storage to Logic Contract.
     * @param amount Amount of token
     * @param token Address of token
     */
    function takeToken(uint256 amount, address token)
        external
        isLogicContract(msg.sender)
        isUsedToken(token)
    {
        uint8 decimals = AggregatorV3Interface(token).decimals();
        uint256 amountExp18 = amount * 10**(18 - decimals);
        IERC20Upgradeable(token).safeTransfer(msg.sender, amount);
        tokenBalance[token] = tokenBalance[token] - amountExp18;

        emit UpdateTokenBalance(tokenBalance[token], token);
        emit TakeToken(token, amountExp18);
    }

    /**
     * @notice Transfer amount of token from Storage to Logic Contract.
     * @param amount Amount of token
     * @param token Address of token
     */
    function returnToken(uint256 amount, address token)
        external
        isLogicContract(msg.sender)
        isUsedToken(token)
    {
        uint8 decimals = AggregatorV3Interface(token).decimals();
        uint256 amountExp18 = amount * 10**(18 - decimals);
        IERC20Upgradeable(token).safeTransferFrom(logicContract, address(this), amount);
        tokenBalance[token] = tokenBalance[token] + amountExp18;

        emit UpdateTokenBalance(tokenBalance[token], token);
        emit ReturnToken(token, amountExp18);
    }

    /**
     * @notice Claim all BLID(from strategy and boost) for user
     */
    function claimAllRewardBLID() external {
        interestFee(msg.sender);
        _claimBoostingRewardBLIDInternal(msg.sender, true);
    }

    /**
     * @notice Take amount BLID from Logic contract  and distributes earned BLID
     * @param amount Amount of distributes earned BLID
     */
    function addEarn(uint256 amount) external isLogicContract(msg.sender) {
        IERC20Upgradeable(BLID).safeTransferFrom(msg.sender, address(this), amount);
        reserveBLID += amount;
        int256 _dollarTime = 0;
        uint256 countTokens_ = countTokens;
        uint256 countEarns_ = countEarns;
        EarnBLID storage thisEarnBLID = earnBLID[countEarns_];
        for (uint256 i = 0; i < countTokens_; i++) {
            address token = tokens[i];
            AggregatorV3Interface oracle = AggregatorV3Interface(oracles[token]);
            thisEarnBLID.rates[token] = (uint256(oracle.latestAnswer()) * 10**(18 - oracle.decimals()));

            // count all deposited token in usd
            thisEarnBLID.usd += tokenDeposited[token] * thisEarnBLID.rates[token];

            // convert token time to dollar time
            _dollarTime += tokenTime[token] * int256(thisEarnBLID.rates[token]);
        }
        require(_dollarTime != 0);
        thisEarnBLID.allBLID = amount;
        thisEarnBLID.timestamp = block.timestamp;
        thisEarnBLID.tdt = uint256(
            (int256(((block.timestamp) * thisEarnBLID.usd)) - _dollarTime) / (1 ether)
        ); // count delta of current token time and all user token time

        for (uint256 i = 0; i < countTokens_; i++) {
            address token = tokens[i];
            tokenTime[token] = int256(tokenDeposited[token] * block.timestamp); // count curent token time
            updateAccumulatedRewardsPerShareById(token, countEarns_);
        }
        thisEarnBLID.usd /= (1 ether);
        countEarns++;

        emit AddEarn(amount);
        emit UpdateBLIDBalance(reserveBLID);
    }

    /*** External function ***/

    /**
     * @notice Counts the number of accrued СSR
     * @param account Address of Depositor
     */
    function _upBalance(address account) external {
        deposits[account].balanceBLID = balanceEarnBLID(account);
        deposits[account].iterate = countEarns;
    }

    /***  Public View function ***/

    /**
     * @notice Return earned blid
     * @param account Address of Depositor
     */
    function balanceEarnBLID(address account) public view returns (uint256) {
        DepositStruct storage depositor = deposits[account];
        if (depositor.tokenTime[address(0)] == 0 || countEarns == 0) {
            return 0;
        }
        if (countEarns == depositor.iterate) return depositor.balanceBLID;

        uint256 countTokens_ = countTokens;
        uint256 sum = 0;
        uint256 depositorIterate = depositor.iterate;
        for (uint256 j = 0; j < countTokens_; j++) {
            address token = tokens[j];
            //if iterate when user deposited
            if (depositorIterate == depositor.depositIterate[token]) {
                sum += getEarnedInOneDepositedIterate(depositorIterate, token, account);
                sum += getEarnedInOneNotDepositedIterate(depositorIterate, token, account);
            } else {
                sum += getEarnedInOneNotDepositedIterate(depositorIterate - 1, token, account);
            }
        }

        return sum + depositor.balanceBLID;
    }

    /**
     * @notice Return usd balance of account
     * @param account Address of Depositor
     */
    function balanceOf(address account) public view returns (uint256) {
        uint256 countTokens_ = countTokens;
        uint256 sum = 0;
        for (uint256 j = 0; j < countTokens_; j++) {
            address token = tokens[j];
            AggregatorV3Interface oracle = AggregatorV3Interface(oracles[token]);

            sum += ((deposits[account].amount[token] *
                uint256(oracle.latestAnswer()) *
                10**(18 - oracle.decimals())) / (1 ether));
        }
        return sum;
    }

    /**
     * @notice Return sums of all distribution BLID.
     */
    function getBLIDReserve() external view returns (uint256) {
        return reserveBLID;
    }

    /**
     * @notice Return deposited usd
     */
    function getTotalDeposit() external view returns (uint256) {
        uint256 countTokens_ = countTokens;
        uint256 sum = 0;
        for (uint256 j = 0; j < countTokens_; j++) {
            address token = tokens[j];
            AggregatorV3Interface oracle = AggregatorV3Interface(oracles[token]);
            sum +=
                (tokenDeposited[token] * uint256(oracle.latestAnswer()) * 10**(18 - oracle.decimals())) /
                (1 ether);
        }
        return sum;
    }

    /**
     * @notice Returns the balance of token on this contract
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return tokenBalance[token];
    }

    /**
     * @notice Return deposited token from account
     */
    function getTokenDeposit(address account, address token) external view returns (uint256) {
        return deposits[account].amount[token];
    }

    /**
     * @notice Return true if _token  is in token list
     * @param _token Address of Token
     */
    function _isUsedToken(address _token) external view returns (bool) {
        return tokensAdd[_token];
    }

    /**
     * @notice Return count distribution BLID token.
     */
    function getCountEarns() external view returns (uint256) {
        return countEarns;
    }

    /**
     * @notice Return data on distribution BLID token.
     * First return value is amount of distribution BLID token.
     * Second return value is a timestamp when  distribution BLID token completed.
     * Third return value is an amount of dollar depositedhen  distribution BLID token completed.
     */
    function getEarnsByID(uint256 id)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (earnBLID[id].allBLID, earnBLID[id].timestamp, earnBLID[id].usd);
    }

    /**
     * @notice Return amount of all deposited token
     * @param token Address of Token
     */
    function getTokenDeposited(address token) external view returns (uint256) {
        return tokenDeposited[token];
    }

    /**
     * @notice Return pending BLID amount for boost to see on frontend
     * @param _user address of user
     */

    function getBoostingClaimableBLID(address _user) external view returns (uint256) {
        BoostInfo storage userBoost = userBoosts[_user];
        uint256 _accBLIDpershare = accBlidPerShare;
        if (block.number > lastRewardBlock) {
            uint256 passedblockcount = block.number - lastRewardBlock + 1; // When claim 1 block is added because of mining
            _accBLIDpershare = accBlidPerShare + (passedblockcount * blidPerBlock);
        }
        uint256 calcAmount = (userBoost.blidDeposit * _accBLIDpershare) / 1e18;
        return calcAmount > userBoost.rewardDebt ? calcAmount - userBoost.rewardDebt : 0;
    }

    /*** Private Function ***/

    /**
     * @notice deposit token
     * @param amount Amount of deposit token
     * @param token Address of token
     * @param accountAddress Address of depositor
     */
    function depositInternal(
        uint256 amount,
        address token,
        address accountAddress
    ) internal {
        require(amount > 0, "E3");
        uint8 decimals = AggregatorV3Interface(token).decimals();
        DepositStruct storage depositor = deposits[accountAddress];
        IERC20Upgradeable(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 amountExp18 = amount * 10**(18 - decimals);
        if (depositor.tokenTime[address(0)] == 0) {
            depositor.iterate = countEarns;
            depositor.depositIterate[token] = countEarns;
            depositor.tokenTime[address(0)] = 1;
            depositor.tokenTime[token] += int256(block.timestamp * (amountExp18));
        } else {
            interestFee(accountAddress);
            if (depositor.depositIterate[token] == countEarns) {
                depositor.tokenTime[token] += int256(block.timestamp * (amountExp18));
            } else {
                depositor.tokenTime[token] = int256(
                    depositor.amount[token] *
                        earnBLID[countEarns - 1].timestamp +
                        block.timestamp *
                        (amountExp18)
                );

                depositor.depositIterate[token] = countEarns;
            }
        }
        depositor.amount[token] += amountExp18;

        tokenTime[token] += int256(block.timestamp * (amountExp18));
        tokenBalance[token] += amountExp18;
        tokenDeposited[token] += amountExp18;

        // Claim BoostingRewardBLID
        _claimBoostingRewardBLIDInternal(accountAddress, true);

        emit UpdateTokenBalance(tokenBalance[token], token);
        emit Deposit(accountAddress, token, amountExp18);
    }

    // Safe blid transfer function, just in case if rounding error causes pool to not have enough BLIDs.
    function safeBlidTransfer(address _to, uint256 _amount) internal {
        IERC20Upgradeable(BLID).safeTransferFrom(boostingAddress, _to, _amount);
    }

    /**
     * @notice Count accumulatedRewardsPerShare
     * @param token Address of Token
     * @param id of accumulatedRewardsPerShare
     */
    function updateAccumulatedRewardsPerShareById(address token, uint256 id) private {
        EarnBLID storage thisEarnBLID = earnBLID[id];
        //unchecked is used because if id = 0 then  accumulatedRewardsPerShare[token][id-1] equal zero
        unchecked {
            accumulatedRewardsPerShare[token][id] =
                accumulatedRewardsPerShare[token][id - 1] +
                ((thisEarnBLID.allBLID *
                    (thisEarnBLID.timestamp - earnBLID[id - 1].timestamp) *
                    thisEarnBLID.rates[token]) / thisEarnBLID.tdt);
        }
    }

    /**
     * @notice Count user rewards in one iterate, when he  deposited
     * @param token Address of Token
     * @param depositIterate iterate when deposit happened
     * @param account Address of Depositor
     */
    function getEarnedInOneDepositedIterate(
        uint256 depositIterate,
        address token,
        address account
    ) private view returns (uint256) {
        EarnBLID storage thisEarnBLID = earnBLID[depositIterate];
        DepositStruct storage thisDepositor = deposits[account];
        return
            (// all distibution BLID multiply to
            thisEarnBLID.allBLID *
                // delta of  user dollar time and user dollar time if user deposited in at the beginning distibution
                uint256(
                    int256(thisDepositor.amount[token] * thisEarnBLID.rates[token] * thisEarnBLID.timestamp) -
                        thisDepositor.tokenTime[token] *
                        int256(thisEarnBLID.rates[token])
                )) /
            //div to delta of all users dollar time and all users dollar time if all users deposited in at the beginning distibution
            thisEarnBLID.tdt /
            (1 ether);
    }

    /**
     * @notice Claim Boosting Reward BLID to msg.sender
     * @param userAccount address of account
     * @param isAdjust true : adjust userBoost.blidDeposit, false : not update userBoost.blidDeposit
     */
    function _claimBoostingRewardBLIDInternal(address userAccount, bool isAdjust) private {
        _boostingUpdateAccBlidPerShare();
        BoostInfo storage userBoost = userBoosts[userAccount];
        uint256 calcAmount;
        if (userBoost.blidDeposit > 0) {
            calcAmount = (userBoost.blidDeposit * accBlidPerShare) / 1e18;
            if (calcAmount > userBoost.rewardDebt) {
                calcAmount -= userBoost.rewardDebt;
                safeBlidTransfer(userAccount, calcAmount);
            }
        }

        // Adjust blidDeposit
        if (isAdjust) {
            uint256 usdDepositAmount = balanceOf(userAccount);
            uint256 blidDepositLimit = (usdDepositAmount * maxBlidPerUSD) / 1e18;
            uint256 totalAmount = userBoost.blidDeposit + userBoost.blidOverDeposit;

            // Update boosting info
            if (totalAmount > blidDepositLimit) {
                userBoost.blidDeposit = blidDepositLimit;
                userBoost.blidOverDeposit = totalAmount - blidDepositLimit;
            } else {
                userBoost.blidDeposit = totalAmount;
                userBoost.blidOverDeposit = 0;
            }

            // Update rewards debt
            userBoost.rewardDebt = (userBoost.blidDeposit * accBlidPerShare) / 1e18;
        }

        emit ClaimBoostBLID(userAccount, calcAmount);
    }

    /**
     * @notice update Accumulated BLID per share
     */
    function _boostingUpdateAccBlidPerShare() internal {
        if (block.number <= lastRewardBlock) {
            return;
        }

        uint256 passedblockcount = block.number - lastRewardBlock;
        accBlidPerShare = accBlidPerShare + (passedblockcount * blidPerBlock);
        lastRewardBlock = block.number;
    }

    /*** Private View Function ***/

    /**
     * @notice Count user rewards in one iterate, when he was not deposit
     * @param token Address of Token
     * @param depositIterate iterate when deposit happened
     * @param account Address of Depositor
     */
    function getEarnedInOneNotDepositedIterate(
        uint256 depositIterate,
        address token,
        address account
    ) private view returns (uint256) {
        return
            ((accumulatedRewardsPerShare[token][countEarns - 1] -
                accumulatedRewardsPerShare[token][depositIterate]) * deposits[account].amount[token]) /
            (1 ether);
    }
}
