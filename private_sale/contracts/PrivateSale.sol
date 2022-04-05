// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./TokenVestingGroup.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestAnswer() external view returns (int256 answer);
}

interface IBurnable {
    function burn(uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;
}

contract PrivateSale is Ownable {
    using SafeERC20 for IERC20;

    //struct-------------------------------------------
    struct Round {
        mapping(address => bool) whiteList;
        mapping(address => uint256) sums;
        mapping(address => address) depositToken;
        mapping(address => uint256) tokenReserve;
        uint256 totalReserve;
        uint256 tokensSold;
        uint256 tokenRate;
        uint256 maxMoney;
        uint256 sumTokens;
        uint256 minimumSaleAmount;
        uint256 maximumSaleAmount;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 duration;
        uint256 durationCount;
        uint256 lockup;
        TokenVestingGroup vestingContract;
        uint8 percentOnInvestorWallet;
        uint8 typeRound;
        bool finished;
        bool open;
        bool burnable;
    }

    struct InputNewRound {
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

    //variable-----------------------------------
    mapping(uint256 => Round) rounds;
    address investorWallet;
    uint256 countRound;
    uint256 countTokens;
    mapping(uint256 => address) tokens;
    mapping(address => address) oracles;
    mapping(address => bool) tokensAdd;

    address BLID;
    address expenseAddress;

    //modifiers-----------------------------------
    modifier isUsedToken(address _token) {
        require(tokensAdd[_token], "Token is not used ");
        _;
    }

    modifier finishedRound() {
        require(countRound == 0 || rounds[countRound - 1].finished, "Last round has not been finished");
        _;
    }

    modifier unfinishedRound() {
        require(countRound != 0 && !rounds[countRound - 1].finished, "Last round has  been finished");
        _;
    }

    modifier existRound(uint256 round) {
        require(round < countRound, "Number round more than Rounds count");
        _;
    }

    //user function-------------------------------------------------------------
    function deposit(uint256 amount, address token) external isUsedToken(token) unfinishedRound {
        require(rounds[countRound - 1].open || rounds[countRound - 1].whiteList[msg.sender], "No access");
        require(!isParticipatedInTheRound(countRound - 1), "You have already made a deposit");
        require(rounds[countRound - 1].startTimestamp < block.timestamp, "Round dont start");
        require(
            rounds[countRound - 1].minimumSaleAmount <= amount * 10**(18 - AggregatorV3Interface(token).decimals()),
            "Minimum sale amount more than your amount"
        );
        require(
            rounds[countRound - 1].maximumSaleAmount == 0 ||
                rounds[countRound - 1].maximumSaleAmount >= amount * 10**(18 - AggregatorV3Interface(token).decimals()),
            " Your amount more than maximum sale amount"
        );
        require(
            rounds[countRound - 1].endTimestamp > block.timestamp || rounds[countRound - 1].endTimestamp == 0,
            "Round is ended, round time expired"
        );
        require(
            rounds[countRound - 1].tokenRate == 0 ||
                rounds[countRound - 1].sumTokens == 0 ||
                rounds[countRound - 1].sumTokens >=
                ((rounds[countRound - 1].totalReserve + amount * 10**(18 - AggregatorV3Interface(token).decimals())) *
                    (1 ether)) /
                    rounds[countRound - 1].tokenRate,
            "Round is ended, all tokens sold"
        );
        require(
            rounds[countRound - 1].maxMoney == 0 ||
                rounds[countRound - 1].maxMoney >=
                (rounds[countRound - 1].totalReserve + amount * 10**(18 - AggregatorV3Interface(token).decimals())),
            "The round is over, the maximum required value has been reached, or your amount is greater than specified in the conditions of the round"
        );
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        rounds[countRound - 1].tokenReserve[token] += amount * 10**(18 - AggregatorV3Interface(token).decimals());
        rounds[countRound - 1].sums[msg.sender] += amount * 10**(18 - AggregatorV3Interface(token).decimals());
        rounds[countRound - 1].depositToken[msg.sender] = token;
        rounds[countRound - 1].totalReserve += amount * 10**(18 - AggregatorV3Interface(token).decimals());
        rounds[countRound - 1].vestingContract.deposit(
            msg.sender,
            token,
            amount * 10**(18 - AggregatorV3Interface(token).decimals())
        );
    }

    function returnDeposit(uint256 round) external {
        require(round < countRound, "Number round more than Rounds count");
        require(rounds[round].sums[msg.sender] > 0, "You don't have deposit or you return your deposit");
        require(!rounds[round].finished || rounds[round].typeRound == 0, "round has been finished successfully");
        IERC20(rounds[round].depositToken[msg.sender]).safeTransfer(
            msg.sender,
            rounds[round].sums[msg.sender] /
                10**(18 - AggregatorV3Interface(rounds[round].depositToken[msg.sender]).decimals())
        );
        rounds[round].vestingContract.returnDeposit(msg.sender);
        rounds[round].totalReserve -= rounds[round].sums[msg.sender];
        rounds[round].tokenReserve[rounds[round].depositToken[msg.sender]] -= rounds[round].sums[msg.sender];
        rounds[round].sums[msg.sender] = 0;
        rounds[round].depositToken[msg.sender] = address(0);
    }

    //owner functions
    function addToken(address _token, address _oracles) external onlyOwner {
        require(_token != address(0) && _oracles != address(0));
        require(!tokensAdd[_token], "token was added");
        oracles[_token] = _oracles;
        tokens[countTokens++] = _token;
        tokensAdd[_token] = true;
    }

    function setInvestorWallet(address _investorWallet) external onlyOwner finishedRound {
        investorWallet = _investorWallet;
    }

    function setExpenseAddress(address _expenseAddress) external onlyOwner finishedRound {
        expenseAddress = _expenseAddress;
    }

    function setExpenseAddressAndInvestorWallet(address _expenseAddress, address _investorWallet)
        external
        onlyOwner
        finishedRound
    {
        expenseAddress = _expenseAddress;
        investorWallet = _investorWallet;
    }

    function setBLID(address _BLID) external onlyOwner {
        require(BLID == address(0), "BLID was set");
        BLID = _BLID;
    }

    function newRound(InputNewRound memory input) external onlyOwner finishedRound {
        require(BLID != address(0), "BLID is not set");
        require(expenseAddress != address(0), "Require set expense address ");
        require(investorWallet != address(0) || input._percentOnInvestorWallet == 0, "Require set Logic contract");
        require(
            input._endTimestamp == 0 || input._endTimestamp > block.timestamp,
            "_endTimestamp must be unset or more than now timestamp"
        );
        if (input._typeRound == 1) {
            require(input._tokenRate > 0, "Need set _tokenRate and _tokenRate must be more than 0");
            require(
                IERC20(BLID).balanceOf(address(this)) >= input._sumTokens,
                "_sumTokens more than this smart contract have BLID"
            );
            require(input._sumTokens > 0, "Need set _sumTokens ");
            rounds[countRound].tokenRate = input._tokenRate;
            rounds[countRound].maxMoney = input._maxMoney;
            rounds[countRound].startTimestamp = input._startTimestamp;
            rounds[countRound].sumTokens = input._sumTokens;
            rounds[countRound].endTimestamp = input._endTimestamp;
            rounds[countRound].duration = input._duration;
            rounds[countRound].durationCount = input._durationCount;
            rounds[countRound].minimumSaleAmount = input._minimumSaleAmount;
            rounds[countRound].maximumSaleAmount = input._maximumSaleAmount;
            rounds[countRound].lockup = input._lockup;
            rounds[countRound].percentOnInvestorWallet = input._percentOnInvestorWallet;
            rounds[countRound].burnable = input._burnable;
            rounds[countRound].open = input._open;
            rounds[countRound].typeRound = input._typeRound;
            address[] memory inputTokens = new address[](countTokens);
            for (uint256 i = 0; i < countTokens; i++) {
                inputTokens[i] = tokens[i];
            }
            rounds[countRound].vestingContract = new TokenVestingGroup(
                BLID,
                input._duration,
                input._durationCount,
                inputTokens
            );
            countRound++;
        } else if (input._typeRound == 2) {
            require(input._sumTokens > 0, "Need set _sumTokens");
            require(input._tokenRate == 0, "Need unset _tokenRate (_tokenRate==0)");
            require(!input._burnable, "Need not burnable round");
            require(
                IERC20(BLID).balanceOf(address(this)) >= input._sumTokens,
                "_sumTokens more than this smart contract have BLID"
            );
            rounds[countRound].tokenRate = input._tokenRate;
            rounds[countRound].maxMoney = input._maxMoney;
            rounds[countRound].startTimestamp = input._startTimestamp;
            rounds[countRound].endTimestamp = input._endTimestamp;
            rounds[countRound].sumTokens = input._sumTokens;
            rounds[countRound].duration = input._duration;
            rounds[countRound].minimumSaleAmount = input._minimumSaleAmount;
            rounds[countRound].maximumSaleAmount = input._maximumSaleAmount;
            rounds[countRound].durationCount = input._durationCount;
            rounds[countRound].lockup = input._lockup;
            rounds[countRound].percentOnInvestorWallet = input._percentOnInvestorWallet;
            rounds[countRound].burnable = input._burnable;
            rounds[countRound].open = input._open;
            rounds[countRound].typeRound = input._typeRound;
            address[] memory inputTokens = new address[](countTokens);
            for (uint256 i = 0; i < countTokens; i++) {
                inputTokens[i] = (tokens[i]);
            }
            rounds[countRound].vestingContract = new TokenVestingGroup(
                BLID,
                input._duration,
                input._durationCount,
                inputTokens
            );
            countRound++;
        }
    }

    function setRateToken(uint256 rate) external onlyOwner unfinishedRound {
        require(rounds[countRound - 1].typeRound == 1, "This round auto generate rate");
        rounds[countRound - 1].tokenRate = rate;
    }

    function setEndTimestamp(uint256 _endTimestamp) external onlyOwner unfinishedRound {
        rounds[countRound - 1].endTimestamp = _endTimestamp;
    }

    function setSumTokens(uint256 _sumTokens) external onlyOwner unfinishedRound {
        require(
            IERC20(BLID).balanceOf(address(this)) >= _sumTokens,
            "_sumTokens more than this smart contract have BLID"
        );
        require(_sumTokens > rounds[countRound - 1].tokensSold, "Token sold more than _sumTokens");
        rounds[countRound - 1].sumTokens = _sumTokens;
    }

    function setStartTimestamp(uint256 _startTimestamp) external onlyOwner unfinishedRound {
        require(block.timestamp < _startTimestamp, "Round has been started");
        rounds[countRound - 1].startTimestamp = _startTimestamp;
    }

    function setMaxMoney(uint256 _maxMoney) external onlyOwner unfinishedRound {
        require(rounds[countRound - 1].totalReserve < _maxMoney, "Now total reserve more than _maxMoney");
        rounds[countRound - 1].maxMoney = _maxMoney;
    }

    function addWhiteList(address account) external onlyOwner unfinishedRound {
        rounds[countRound - 1].whiteList[account] = true;
    }

    function addWhiteListByArray(address[] calldata accounts) external onlyOwner unfinishedRound {
        for (uint256 i = 0; i < accounts.length; i++) {
            rounds[countRound - 1].whiteList[accounts[i]] = true;
        }
    }

    function deleteWhiteList(address account) external onlyOwner unfinishedRound {
        rounds[countRound - 1].whiteList[account] = false;
    }

    function deleteWhiteListByArray(address[] calldata accounts) external onlyOwner unfinishedRound {
        for (uint256 i = 0; i < accounts.length; i++) {
            rounds[countRound - 1].whiteList[accounts[i]] = false;
        }
    }

    function finishRound() external onlyOwner {
        require(countRound != 0 && !rounds[countRound - 1].finished, "Last round has been finished");
        uint256[] memory rates = new uint256[](countTokens);
        uint256 sumUSD = 0;
        for (uint256 i = 0; i < countTokens; i++) {
            if (rounds[countRound - 1].tokenReserve[tokens[i]] == 0) continue;
            IERC20(tokens[i]).safeTransfer(
                expenseAddress,
                rounds[countRound - 1].tokenReserve[tokens[i]] /
                    10**(18 - AggregatorV3Interface(tokens[i]).decimals()) -
                    ((rounds[countRound - 1].tokenReserve[tokens[i]] /
                        10**(18 - AggregatorV3Interface(tokens[i]).decimals())) *
                        (rounds[countRound - 1].percentOnInvestorWallet)) /
                    100
            );
            IERC20(tokens[i]).safeTransfer(
                investorWallet,
                ((rounds[countRound - 1].tokenReserve[tokens[i]] /
                    10**(18 - AggregatorV3Interface(tokens[i]).decimals())) *
                    (rounds[countRound - 1].percentOnInvestorWallet)) / 100
            );
            rates[i] = (uint256(AggregatorV3Interface(oracles[tokens[i]]).latestAnswer()) *
                10**(18 - AggregatorV3Interface(oracles[tokens[i]]).decimals()));

            sumUSD += (rounds[countRound - 1].tokenReserve[tokens[i]] * rates[i]) / (1 ether);
            if (rounds[countRound - 1].typeRound == 1)
                rates[i] = (rates[i] * (1 ether)) / rounds[countRound - 1].tokenRate;
            if (rounds[countRound - 1].typeRound == 2)
                rates[i] = (rounds[countRound - 1].sumTokens * rates[i]) / sumUSD;
        }
        if (sumUSD != 0) {
            rounds[countRound - 1].vestingContract.finishRound(block.timestamp + rounds[countRound - 1].lockup, rates);
            if (rounds[countRound - 1].typeRound == 1)
                IERC20(BLID).safeTransfer(
                    address(rounds[countRound - 1].vestingContract),
                    (sumUSD * (1 ether)) / rounds[countRound - 1].tokenRate
                );
        }
        if (rounds[countRound - 1].typeRound == 2)
            IERC20(BLID).safeTransfer(
                address(rounds[countRound - 1].vestingContract),
                rounds[countRound - 1].sumTokens
            );
        if (
            rounds[countRound - 1].burnable &&
            rounds[countRound - 1].sumTokens - (sumUSD * (1 ether)) / rounds[countRound - 1].tokenRate != 0
        ) {
            IBurnable(BLID).burn(
                rounds[countRound - 1].sumTokens - (sumUSD * (1 ether)) / rounds[countRound - 1].tokenRate
            );
        }
        rounds[countRound - 1].finished = true;
    }

    function cancelRound() external onlyOwner {
        require(countRound != 0 && !rounds[countRound - 1].finished, "Last round has been finished");
        rounds[countRound - 1].finished = true;
        rounds[countRound - 1].typeRound = 0;
    }

    function getRoundStateInfromation(uint256 id) public view returns (InputNewRound memory) {
        InputNewRound memory out = InputNewRound(
            rounds[id].tokenRate,
            rounds[id].maxMoney,
            rounds[id].sumTokens,
            rounds[id].startTimestamp,
            rounds[id].endTimestamp,
            rounds[id].minimumSaleAmount,
            rounds[id].maximumSaleAmount,
            rounds[id].duration,
            rounds[id].durationCount,
            rounds[id].lockup,
            rounds[id].typeRound,
            rounds[id].percentOnInvestorWallet,
            rounds[id].burnable,
            rounds[id].open
        );
        return out;
    }

    function getLockedTokens(uint256 id) public view returns (uint256) {
        if (rounds[id].tokenRate == 0) return 0;
        return ((rounds[id].totalReserve * (1 ether)) / rounds[id].tokenRate);
    }

    function getRoundDynamicInfromation(uint256 id)
        public
        view
        returns (
            uint256,
            uint256,
            bool
        )
    {
        if (rounds[id].typeRound == 1) {
            return (rounds[id].totalReserve, rounds[id].totalReserve / rounds[id].tokenRate, rounds[id].open);
        } else {
            return (rounds[id].totalReserve, rounds[id].sumTokens, rounds[id].open);
        }
    }

    function isInWhiteList(address account) public view returns (bool) {
        return rounds[countRound - 1].whiteList[account];
    }

    function getCountRound() public view returns (uint256) {
        return countRound;
    }

    function getVestingAddress(uint256 id) public view existRound(id) returns (address) {
        return address(rounds[id].vestingContract);
    }

    function getInvestorDepositedTokens(uint256 id, address account) public view existRound(id) returns (uint256) {
        return (rounds[id].sums[account]);
    }

    function getInvestorWallet() public view returns (address) {
        return investorWallet;
    }

    function isCancelled(uint256 id) public view existRound(id) returns (bool) {
        return rounds[id].typeRound == 0;
    }

    function isParticipatedInTheRound(uint256 id) public view existRound(id) returns (bool) {
        return rounds[id].depositToken[msg.sender] != address(0);
    }

    function getUserToken(uint256 id) public view existRound(id) returns (address) {
        return rounds[id].depositToken[msg.sender];
    }

    function isFinished(uint256 id) public view returns (bool) {
        return rounds[id].finished;
    }
}
