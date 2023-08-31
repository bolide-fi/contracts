/*******************************************
 * Test on hardhat
 * In order to test LendToken, please disable "ILogicContract(_logic).mint(vTokens[token], amount)"
 * in LendBorrowLendStrategy.lendToken() function
 *******************************************/

import {ethers, upgrades} from "hardhat";
import {
  ERC20,
  StorageV3,
  Aggregator,
  AggregatorN3,
  MultiLogic,
  LogicV3,
  LendBorrowFarmStrategyV2,
  LendBorrowFarmingPair,
  VenusComptroller,
} from "../../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {logValue} from "../../utils/helpers";
import {expect} from "chai";
import {BigNumber} from "ethers";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const storageV3_leaveToken = () => {
  let tx,
    balance,
    blid: ERC20,
    usdt: ERC20,
    usdc: ERC20,
    vusdt: ERC20,
    vusdc: ERC20,
    vbnb: ERC20,
    banana: ERC20,
    storage: StorageV3,
    aggregator: Aggregator,
    aggregator3: AggregatorN3,
    multiLogicProxy: MultiLogic,
    lbfStrategy: LendBorrowFarmStrategyV2,
    lblStrategy: LendBorrowFarmStrategyV2,
    lbfPair: LendBorrowFarmingPair,
    lbfLogic: LogicV3,
    lblLogic: LogicV3,
    venusComptroller: VenusComptroller;

  let owner: SignerWithAddress,
    other1: SignerWithAddress,
    other2: SignerWithAddress,
    other3: SignerWithAddress,
    other4: SignerWithAddress,
    other5: SignerWithAddress,
    other6: SignerWithAddress,
    other7: SignerWithAddress;

  // Testing values
  const leaveLimit = 10000;
  const leavePercentage = 1000;
  const leaveFixed = 1000;

  const calcAvailable = (amount: number) => {
    let result: number;
    if (amount <= leaveLimit) result = amount * (1 - leavePercentage / 10000);
    else result = amount - leaveFixed;

    return ethers.utils.parseEther(result.toString()).toString();
  };

  before(async () => {
    [owner, other1, other2, other3, other4, other5, other6, other7] =
      await ethers.getSigners();

    const Storage = await ethers.getContractFactory("StorageV3", owner);
    const Aggregator = await ethers.getContractFactory("Aggregator", owner);
    const AggregatorN3 = await ethers.getContractFactory("AggregatorN3", owner);
    const MultiLogicProxy = await ethers.getContractFactory(
      "MultiLogic",
      owner
    );
    const BLID = await ethers.getContractFactory("ERC20", owner);
    const USDT = await ethers.getContractFactory("ERC20", owner);
    const USDC = await ethers.getContractFactory("ERC20", owner);
    const vUSDT = await ethers.getContractFactory("ERC20", owner);
    const vUSDC = await ethers.getContractFactory("ERC20", owner);
    const vBNB = await ethers.getContractFactory("ERC20", owner);
    const BANANA = await ethers.getContractFactory("ERC20", owner);
    const LBFStrategy = await ethers.getContractFactory(
      "LendBorrowFarmStrategyV2",
      owner
    );
    const libraryFactory = await ethers.getContractFactory(
      "LendBorrowLendStrategyHelper",
      {
        signer: owner,
      }
    );

    const LBFPair = await ethers.getContractFactory(
      "LendBorrowFarmingPair",
      owner
    );
    const LBFLogic = await ethers.getContractFactory("LogicV3", owner);
    const LBLLogic = await ethers.getContractFactory("LogicV3", owner);
    const VenusComptroller = await ethers.getContractFactory(
      "VenusComptroller",
      owner
    );

    aggregator = (await Aggregator.deploy()) as Aggregator;
    aggregator3 = (await AggregatorN3.deploy()) as AggregatorN3;
    blid = (await BLID.deploy("some erc20", "SERC")) as ERC20;
    usdt = (await USDT.deploy("some erc20", "SERC")) as ERC20;
    usdc = (await USDC.deploy("some erc20", "SERC")) as ERC20;
    vusdt = (await vUSDT.deploy("some erc20", "SERC")) as ERC20;
    vusdc = (await vUSDC.deploy("some erc20", "SERC")) as ERC20;
    vbnb = (await vUSDC.deploy("some erc20", "SERC")) as ERC20;
    banana = (await BANANA.deploy("some erc20", "SERC")) as ERC20;
    venusComptroller = (await VenusComptroller.deploy()) as VenusComptroller;

    storage = (await upgrades.deployProxy(Storage, [], {
      initializer: "initialize",
      unsafeAllow: ["constructor"],
    })) as StorageV3;
    await storage.deployed();

    lbfLogic = (await upgrades.deployProxy(
      LBFLogic,
      [
        owner.address,
        venusComptroller.address,
        venusComptroller.address,
        venusComptroller.address,
        other1.address,
        other2.address,
        other3.address,
        other4.address,
        other5.address,
        other6.address,
      ],
      {
        kind: "uups",
        initializer: "__Logic_init",
      }
    )) as LogicV3;
    await lbfLogic.deployed();

    lblLogic = (await upgrades.deployProxy(
      LBLLogic,
      [
        owner.address,
        venusComptroller.address,
        venusComptroller.address,
        venusComptroller.address,
        other1.address,
        other2.address,
        other3.address,
        other4.address,
        other5.address,
        other6.address,
      ],
      {
        kind: "uups",
        initializer: "__Logic_init",
      }
    )) as LogicV3;
    await lblLogic.deployed();

    lbfPair = (await upgrades.deployProxy(LBFPair, [], {
      kind: "uups",
      initializer: "__LendBorrowFarmingPair_init",
    })) as LendBorrowFarmingPair;
    await lbfPair.deployed();

    lbfStrategy = (await upgrades.deployProxy(
      LBFStrategy,
      [
        venusComptroller.address,
        other7.address,
        banana.address,
        lbfLogic.address,
        lbfPair.address,
      ],
      {
        kind: "uups",
        initializer: "__LendBorrowFarmStrategy_init",
      }
    )) as LendBorrowFarmStrategyV2;
    await lbfStrategy.deployed();

    lblStrategy = (await upgrades.deployProxy(
      LBFStrategy,
      [
        venusComptroller.address,
        other7.address,
        banana.address,
        lblLogic.address,
        lbfPair.address,
      ],
      {
        kind: "uups",
        initializer: "__LendBorrowFarmStrategy_init",
      }
    )) as LendBorrowFarmStrategyV2;
    await lbfStrategy.deployed();

    multiLogicProxy = (await upgrades.deployProxy(MultiLogicProxy, [], {
      kind: "uups",
      initializer: "__MultiLogicProxy_init",
    })) as MultiLogic;
    await multiLogicProxy.deployed();

    tx = await lbfLogic
      .connect(owner)
      .setMultiLogicProxy(multiLogicProxy.address);
    await tx.wait(1);

    tx = await lbfLogic.connect(owner).setAdmin(lbfStrategy.address);
    await tx.wait(1);

    tx = await lblLogic
      .connect(owner)
      .setMultiLogicProxy(multiLogicProxy.address);
    await tx.wait(1);

    tx = await lblLogic.connect(owner).setAdmin(lblStrategy.address);
    await tx.wait(1);

    tx = await lbfStrategy
      .connect(owner)
      .setMultiLogicProxy(multiLogicProxy.address);
    await tx.wait(1);

    tx = await lblStrategy
      .connect(owner)
      .setMultiLogicProxy(multiLogicProxy.address);
    await tx.wait(1);

    tx = await storage
      .connect(owner)
      .setMultiLogicProxy(multiLogicProxy.address);
    await tx.wait(1);

    tx = await storage.connect(owner).setBLID(blid.address);
    await tx.wait(1);

    tx = await multiLogicProxy.connect(owner).setStorage(storage.address);
    await tx.wait(1);

    tx = await multiLogicProxy.connect(owner).initStrategies(
      ["LBF", "LBL"],
      [
        {
          logicContract: lbfLogic.address,
          strategyContract: lbfStrategy.address,
        },
        {
          logicContract: lblLogic.address,
          strategyContract: lblStrategy.address,
        },
      ]
    );
    await tx.wait(1);
  });

  before(async () => {
    await usdt
      .connect(owner)
      .transfer(other1.address, ethers.utils.parseEther("1000000000"));
  });

  describe("Prepairation", async () => {
    it("Init token for LBF Strategy", async () => {
      await lbfStrategy
        .connect(owner)
        .addLendingToken(usdt.address, vusdt.address);
      await lbfStrategy
        .connect(owner)
        .addLendingToken(usdc.address, vusdc.address);
      await lbfStrategy
        .connect(owner)
        .addLendingToken(ZERO_ADDRESS, vbnb.address);
    });

    it("add tokens to Storage", async () => {
      await storage.connect(owner).addToken(usdt.address, aggregator3.address);
      await storage.connect(owner).addToken(usdc.address, aggregator.address);
      await storage.connect(owner).addToken(ZERO_ADDRESS, aggregator3.address);
    });

    it("Init Leave Policy for storage", async () => {
      await storage
        .connect(owner)
        .setLeaveTokenPolicy(leaveLimit, leavePercentage, leaveFixed);
    });

    it("USDT percentage - 10000 : 0", async () => {
      tx = await multiLogicProxy
        .connect(owner)
        .setPercentages(usdt.address, [10000, 0]);
      await tx.wait(1);
    });

    it("USDC percentage - 7000 : 3000", async () => {
      tx = await multiLogicProxy
        .connect(owner)
        .setPercentages(usdc.address, [7000, 3000]);
      await tx.wait(1);
    });

    it("BNB percentage - 10000 : 0", async () => {
      tx = await multiLogicProxy
        .connect(owner)
        .setPercentages(ZERO_ADDRESS, [10000, 0]);
      await tx.wait(1);
    });
  });

  describe("Storage with Logic (USDT)", async () => {
    it("Approve 1 USDT for storage", async () => {
      const tx = await usdt
        .connect(owner)
        .approve(storage.address, ethers.utils.parseEther("1"));
      await tx.wait(1);
    });

    it("Deposit 1 USDT from owner to storage", async () => {
      let balanceUSDTOwner = await usdt.balanceOf(owner.address);
      let balanceUSDTStorage = await usdt.balanceOf(storage.address);
      let tokenDeposited = await storage.getTokenDeposited(usdt.address);

      const tx = await storage
        .connect(owner)
        .deposit(ethers.utils.parseEther("1"), usdt.address);
      await tx.wait(1);

      let balanceUSDTOwnerNew = await usdt.balanceOf(owner.address);
      let balanceUSDTStorageNew = await usdt.balanceOf(storage.address);
      let tokenDepositedNew = await storage.getTokenDeposited(usdt.address);

      expect(
        balanceUSDTOwnerNew.add(ethers.utils.parseEther("1")).toString()
      ).to.be.eql(
        balanceUSDTOwner.toString(),
        "USDT balance of owner should be decreased by 1"
      );
      expect(
        balanceUSDTStorage.add(ethers.utils.parseEther("1")).toString()
      ).to.be.eql(
        balanceUSDTStorageNew.toString(),
        "USDT balance of storage should be increased by 1"
      );
      expect(
        tokenDeposited.add(ethers.utils.parseEther("1")).toString()
      ).to.be.eql(
        tokenDepositedNew.toString(),
        "Token deposited should be increated by 1"
      );
    });

    it("Cannot take 0.95 USDT from Storage", async () => {
      await lbfLogic
        .takeTokenFromStorage(ethers.utils.parseEther("0.95"), usdt.address)
        .should.be.revertedWith("M6");
    });

    it("Take 0.8 USDT from Storage", async () => {
      let balanceUSDTLogic = await usdt.balanceOf(lbfLogic.address);
      let balanceUSDTStorage = await usdt.balanceOf(storage.address);
      let tokenDeposited = await storage.getTokenDeposited(usdt.address);

      const tx = await lbfLogic.takeTokenFromStorage(
        ethers.utils.parseEther("0.8"),
        usdt.address
      );
      await tx.wait(1);

      let balanceUSDTLogicNew = await usdt.balanceOf(lbfLogic.address);
      let balanceUSDTStorageNew = await usdt.balanceOf(storage.address);
      let tokenDepositedNew = await storage.getTokenDeposited(usdt.address);

      expect(
        balanceUSDTStorageNew.add(ethers.utils.parseEther("0.8")).toString()
      ).to.be.eql(
        balanceUSDTStorage.toString(),
        "USDT balance of storage should be decreased by 0.8"
      );
      expect(
        balanceUSDTLogic.add(ethers.utils.parseEther("0.8")).toString()
      ).to.be.eql(
        balanceUSDTLogicNew.toString(),
        "USDT balance of logic should be increased by 0.8"
      );
      expect(tokenDeposited.toString()).to.be.eql(
        tokenDepositedNew.toString(),
        "Token deposited should be unchanged"
      );
    });

    it("Withdraw 0.4 USDT from storage to owner", async () => {
      let balanceUSDTOwner = await usdt.balanceOf(owner.address);
      let balanceUSDTLogic = await usdt.balanceOf(lbfLogic.address);
      let tokenDeposited = await storage.getTokenDeposited(usdt.address);

      const tx = await storage
        .connect(owner)
        .withdraw(ethers.utils.parseEther("0.4").toString(), usdt.address);
      await tx.wait(1);

      let balanceUSDTOwnerNew = await usdt.balanceOf(owner.address);
      let balanceUSDTLogicNew = await usdt.balanceOf(lbfLogic.address);
      let tokenDepositedNew = await storage.getTokenDeposited(usdt.address);

      expect(
        balanceUSDTOwner.add(ethers.utils.parseEther("0.4")).toString()
      ).to.be.eql(
        balanceUSDTOwnerNew.toString(),
        "USDT balance of owner should be increased by 0.4"
      );
      expect(
        balanceUSDTLogicNew.add(ethers.utils.parseEther("0.2")).toString()
      ).to.be.eql(
        balanceUSDTLogic.toString(),
        "USDT balance of logic should be decreased by 0.2"
      );
      expect(
        tokenDeposited.sub(ethers.utils.parseEther("0.4")).toString()
      ).to.be.eql(
        tokenDepositedNew.toString(),
        "Token deposited should be decreased by 0.4"
      );
    });

    it("Return 0.1 USDT from Logic to Storage", async () => {
      let balanceUSDTLogic = await usdt.balanceOf(lbfLogic.address);
      let balanceUSDTStorage = await usdt.balanceOf(storage.address);
      let tokenDeposited = await storage.getTokenDeposited(usdt.address);

      const tx = await lbfLogic.returnTokenToStorage(
        ethers.utils.parseEther("0.1"),
        usdt.address
      );
      await tx.wait(1);

      let balanceUSDTLogicNew = await usdt.balanceOf(lbfLogic.address);
      let balanceUSDTStorageNew = await usdt.balanceOf(storage.address);
      let tokenDepositedNew = await storage.getTokenDeposited(usdt.address);

      expect(
        balanceUSDTStorage.add(ethers.utils.parseEther("0.1")).toString()
      ).to.be.eql(
        balanceUSDTStorageNew.toString(),
        "USDT balance of storage should be increased by 0.1"
      );
      expect(
        balanceUSDTLogicNew.add(ethers.utils.parseEther("0.1")).toString()
      ).to.be.eql(
        balanceUSDTLogic.toString(),
        "USDT balance of logic should be decreased by 0.1"
      );
      expect(tokenDeposited.toString()).to.be.eql(
        tokenDepositedNew.toString(),
        "Token deposited should be unchanged"
      );
    });

    it("Withdraw all - 0.6", async () => {
      let balanceUSDTOwner = await usdt.balanceOf(owner.address);
      let balanceUSDTLogic = await usdt.balanceOf(lbfLogic.address);
      let balanceUSDTStorage = await usdt.balanceOf(storage.address);

      const tx = await storage
        .connect(owner)
        .withdraw(ethers.utils.parseEther("0.6").toString(), usdt.address);
      await tx.wait(1);

      let balanceUSDTOwnerNew = await usdt.balanceOf(owner.address);
      let balanceUSDTLogicNew = await usdt.balanceOf(lbfLogic.address);
      let balanceUSDTStorageNew = await usdt.balanceOf(storage.address);
      let tokenDepositedNew = await storage.getTokenDeposited(usdt.address);

      expect(
        balanceUSDTOwner.add(ethers.utils.parseEther("0.6")).toString()
      ).to.be.eql(
        balanceUSDTOwnerNew.toString(),
        "USDT balance of owner should be increased by 0.6"
      );
      expect(
        balanceUSDTLogicNew.add(ethers.utils.parseEther("0.5")).toString()
      ).to.be.eql(
        balanceUSDTLogic.toString(),
        "USDT balance of logic should be decreased by 0.5"
      );
      expect(
        balanceUSDTStorageNew.add(ethers.utils.parseEther("0.1")).toString()
      ).to.be.eql(
        balanceUSDTStorage.toString(),
        "USDT balance of storeage should be increased by 0.1"
      );
      expect(balanceUSDTStorageNew.toString()).to.be.eql(
        "0",
        "USDT balance of storeage should be 0"
      );
      expect(tokenDepositedNew.toString()).to.be.eql(
        "0",
        "Token Deposited should be 0"
      );
    });
  });

  describe("Storage with Logic (BNB)", async () => {
    before(async () => {
      logValue(
        "Logic   balance in Owner",
        await ethers.provider.getBalance(owner.address)
      );
      logValue(
        "Logic   balance in BNB",
        await ethers.provider.getBalance(lbfLogic.address)
      );
      logValue(
        "Storage balance in BNB",
        await ethers.provider.getBalance(storage.address)
      );
      logValue(
        "Proxy   balance in BNB",
        await ethers.provider.getBalance(multiLogicProxy.address)
      );
    });
    after(async () => {
      logValue(
        "Logic   balance in BNB",
        await ethers.provider.getBalance(lbfLogic.address)
      );
      logValue(
        "Storage balance in BNB",
        await ethers.provider.getBalance(storage.address)
      );
      logValue(
        "Proxy   balance in BNB",
        await ethers.provider.getBalance(multiLogicProxy.address)
      );
    });

    it("Deposit 1 BNB from owner to storage", async () => {
      let balanceBNBOwner = await ethers.provider.getBalance(owner.address);
      let balanceBNBStorage = await ethers.provider.getBalance(storage.address);
      let tokenBalance = await storage
        .connect(owner)
        .getTokenBalance(ZERO_ADDRESS);
      let tokenDeposit = await storage
        .connect(owner)
        .getTokenDeposit(owner.address, ZERO_ADDRESS);
      let tokenDepositTotal = await storage
        .connect(owner)
        .getTokenDeposited(ZERO_ADDRESS);

      const tx = await storage
        .connect(owner)
        .deposit(ethers.utils.parseEther("1"), ZERO_ADDRESS, {
          from: owner.address,
          value: ethers.utils.parseEther("1").toString(),
        });
      await tx.wait(1);

      let balanceBNBOwnerNew = await ethers.provider.getBalance(owner.address);
      let balanceBNBStorageNew = await ethers.provider.getBalance(
        storage.address
      );
      let tokenBalanceNew = await storage
        .connect(owner)
        .getTokenBalance(ZERO_ADDRESS);
      let tokenDepositNew = await storage
        .connect(owner)
        .getTokenDeposit(owner.address, ZERO_ADDRESS);
      let tokenDepositTotalNew = await storage
        .connect(owner)
        .getTokenDeposited(ZERO_ADDRESS);

      expect(balanceBNBOwnerNew.lt(balanceBNBOwner)).to.be.eql(
        true,
        "BNB balance of owner should be decreased"
      );
      expect(
        balanceBNBStorage.add(ethers.utils.parseEther("1")).toString()
      ).to.be.eql(
        balanceBNBStorageNew.toString(),
        "BNB balance of storage should be increased by 1"
      );
      expect(
        tokenBalance.add(ethers.utils.parseEther("1")).toString()
      ).to.be.eql(
        tokenBalanceNew.toString(),
        "token balance of storage should be increased by 1"
      );
      expect(
        tokenDeposit.add(ethers.utils.parseEther("1")).toString()
      ).to.be.eql(
        tokenDepositNew.toString(),
        "token deposit of storage should be increased by 1"
      );
      expect(
        tokenDepositTotal.add(ethers.utils.parseEther("1")).toString()
      ).to.be.eql(
        tokenDepositTotalNew.toString(),
        "token deposit total of storage should be increased by 1"
      );
    });

    it("Take 0.7 BNB from Storage", async () => {
      let balanceBNBLogic = await ethers.provider.getBalance(lbfLogic.address);
      let balanceBNBStorage = await ethers.provider.getBalance(storage.address);
      let tokenBalance = await storage
        .connect(owner)
        .getTokenBalance(ZERO_ADDRESS);
      let tokenDeposit = await storage
        .connect(owner)
        .getTokenDeposit(owner.address, ZERO_ADDRESS);
      let tokenDepositTotal = await storage
        .connect(owner)
        .getTokenDeposited(ZERO_ADDRESS);

      const tx = await lbfLogic.takeTokenFromStorage(
        ethers.utils.parseEther("0.7"),
        ZERO_ADDRESS
      );
      await tx.wait(1);

      let balanceBNBLogicNew = await ethers.provider.getBalance(
        lbfLogic.address
      );
      let balanceBNBStorageNew = await ethers.provider.getBalance(
        storage.address
      );
      let tokenBalanceNew = await storage
        .connect(owner)
        .getTokenBalance(ZERO_ADDRESS);
      let tokenDepositNew = await storage
        .connect(owner)
        .getTokenDeposit(owner.address, ZERO_ADDRESS);
      let tokenDepositTotalNew = await storage
        .connect(owner)
        .getTokenDeposited(ZERO_ADDRESS);

      expect(
        balanceBNBStorageNew.add(ethers.utils.parseEther("0.7")).toString()
      ).to.be.eql(
        balanceBNBStorage.toString(),
        "BNB balance of storage should be decreased by 0.7"
      );
      expect(
        balanceBNBLogic.add(ethers.utils.parseEther("0.7")).toString()
      ).to.be.eql(
        balanceBNBLogicNew.toString(),
        "BNB balance of logic should be increased by 0.7"
      );
      expect(
        tokenBalance.sub(ethers.utils.parseEther("0.7")).toString()
      ).to.be.eql(
        tokenBalanceNew.toString(),
        "token balance of storage should be decreased by 0.7"
      );
      expect(tokenDeposit.eq(tokenDepositNew)).to.be.eql(
        true,
        "token deposit of storage should unchanged"
      );
      expect(tokenDepositTotal.eq(tokenDepositTotalNew)).to.be.eql(
        true,
        "token deposit total of storage should be unchanged"
      );
    });

    it("Withdraw 0.4 BNB from storage to owner", async () => {
      let balanceBNBOwner = await ethers.provider.getBalance(owner.address);
      let balanceBNBLogic = await ethers.provider.getBalance(lbfLogic.address);
      let tokenBalance = await storage
        .connect(owner)
        .getTokenBalance(ZERO_ADDRESS);
      let tokenDeposit = await storage
        .connect(owner)
        .getTokenDeposit(owner.address, ZERO_ADDRESS);
      let tokenDepositTotal = await storage
        .connect(owner)
        .getTokenDeposited(ZERO_ADDRESS);

      const tx = await storage
        .connect(owner)
        .withdraw(ethers.utils.parseEther("0.4").toString(), ZERO_ADDRESS);
      await tx.wait(1);

      let balanceBNBOwnerNew = await ethers.provider.getBalance(owner.address);
      let balanceBNBLogicNew = await ethers.provider.getBalance(
        lbfLogic.address
      );
      let tokenBalanceNew = await storage
        .connect(owner)
        .getTokenBalance(ZERO_ADDRESS);
      let tokenDepositNew = await storage
        .connect(owner)
        .getTokenDeposit(owner.address, ZERO_ADDRESS);
      let tokenDepositTotalNew = await storage
        .connect(owner)
        .getTokenDeposited(ZERO_ADDRESS);

      expect(balanceBNBOwner.lt(balanceBNBOwnerNew)).to.be.eql(
        true,
        "BNB balance of owner should be increased"
      );
      expect(
        balanceBNBLogicNew.add(ethers.utils.parseEther("0.1")).toString()
      ).to.be.eql(
        balanceBNBLogic.toString(),
        "BNB balance of logic should be decreased by 0.1"
      );
      expect(
        tokenBalance.sub(ethers.utils.parseEther("0.3")).toString()
      ).to.be.eql(
        tokenBalanceNew.toString(),
        "token balance of storage should be decreased by 0.3"
      );
      expect(
        tokenDeposit.sub(ethers.utils.parseEther("0.4")).toString()
      ).to.be.eql(
        tokenDepositNew.toString(),
        "token deposit of storage should be decreased by 0.4"
      );
      expect(
        tokenDepositTotal.sub(ethers.utils.parseEther("0.4")).toString()
      ).to.be.eql(
        tokenDepositTotalNew.toString(),
        "token deposit total of storage should be decreased by 0.4"
      );
    });

    it("Return 0.1 BNB from Logic to Storage", async () => {
      let balanceBNBLogic = await ethers.provider.getBalance(lbfLogic.address);
      let balanceBNBStorage = await ethers.provider.getBalance(storage.address);
      let tokenBalance = await storage
        .connect(owner)
        .getTokenBalance(ZERO_ADDRESS);
      let tokenDeposit = await storage
        .connect(owner)
        .getTokenDeposit(owner.address, ZERO_ADDRESS);
      let tokenDepositTotal = await storage
        .connect(owner)
        .getTokenDeposited(ZERO_ADDRESS);

      const tx = await lbfLogic.returnTokenToStorage(
        ethers.utils.parseEther("0.1"),
        ZERO_ADDRESS
      );
      await tx.wait(1);

      let balanceBNBLogicNew = await ethers.provider.getBalance(
        lbfLogic.address
      );
      let balanceBNBStorageNew = await ethers.provider.getBalance(
        storage.address
      );
      let tokenBalanceNew = await storage
        .connect(owner)
        .getTokenBalance(ZERO_ADDRESS);
      let tokenDepositNew = await storage
        .connect(owner)
        .getTokenDeposit(owner.address, ZERO_ADDRESS);
      let tokenDepositTotalNew = await storage
        .connect(owner)
        .getTokenDeposited(ZERO_ADDRESS);

      expect(
        balanceBNBStorage.add(ethers.utils.parseEther("0.1")).toString()
      ).to.be.eql(
        balanceBNBStorageNew.toString(),
        "BNB balance of storage should be increased by 0.1"
      );
      expect(
        balanceBNBLogicNew.add(ethers.utils.parseEther("0.1")).toString()
      ).to.be.eql(
        balanceBNBLogic.toString(),
        "BNB balance of logic should be decreased by 0.1"
      );
      expect(
        tokenBalance.add(ethers.utils.parseEther("0.1")).toString()
      ).to.be.eql(
        tokenBalanceNew.toString(),
        "token balance of storage should be increased by 0.1"
      );
      expect(tokenDeposit.eq(tokenDepositNew)).to.be.eql(
        true,
        "token deposit of storage should unchanged"
      );
      expect(tokenDepositTotal.eq(tokenDepositTotalNew)).to.be.eql(
        true,
        "token deposit total of storage should be unchanged"
      );
    });

    it("Withdraw all - 0.6 BNB", async () => {
      let balanceBNBOwner = await ethers.provider.getBalance(owner.address);
      let balanceBNBLogic = await ethers.provider.getBalance(lbfLogic.address);
      let tokenBalance = await storage
        .connect(owner)
        .getTokenBalance(ZERO_ADDRESS);
      let tokenDeposit = await storage
        .connect(owner)
        .getTokenDeposit(owner.address, ZERO_ADDRESS);
      let tokenDepositTotal = await storage
        .connect(owner)
        .getTokenDeposited(ZERO_ADDRESS);

      const tx = await storage
        .connect(owner)
        .withdraw(ethers.utils.parseEther("0.6").toString(), ZERO_ADDRESS);
      await tx.wait(1);

      let balanceBNBOwnerNew = await ethers.provider.getBalance(owner.address);
      let balanceBNBLogicNew = await ethers.provider.getBalance(
        lbfLogic.address
      );
      let tokenBalanceNew = await storage
        .connect(owner)
        .getTokenBalance(ZERO_ADDRESS);
      let tokenDepositNew = await storage
        .connect(owner)
        .getTokenDeposit(owner.address, ZERO_ADDRESS);
      let tokenDepositTotalNew = await storage
        .connect(owner)
        .getTokenDeposited(ZERO_ADDRESS);

      expect(balanceBNBOwner.lt(balanceBNBOwnerNew)).to.be.eql(
        true,
        "BNB balance of owner should be increased"
      );
      expect(
        balanceBNBLogicNew.add(ethers.utils.parseEther("0.5")).toString()
      ).to.be.eql(
        balanceBNBLogic.toString(),
        "BNB balance of logic should be decreased by 0.5"
      );
      expect(
        tokenBalance.sub(ethers.utils.parseEther("0.1")).toString()
      ).to.be.eql(
        tokenBalanceNew.toString(),
        "token balance of storage should be decreased by 0.1"
      );
      expect(
        tokenDeposit.sub(ethers.utils.parseEther("0.6")).toString()
      ).to.be.eql(
        tokenDepositNew.toString(),
        "token deposit of storage should be decreased by 0.6"
      );
      expect(
        tokenDepositTotal.sub(ethers.utils.parseEther("0.6")).toString()
      ).to.be.eql(
        tokenDepositTotalNew.toString(),
        "token deposit total of storage should be decreased by 0.6"
      );

      expect(balanceBNBLogicNew.toString()).to.be.eql(
        "0",
        "BNB balance of logic should be 0"
      );
      expect(tokenBalanceNew.toString()).to.be.eql(
        "0",
        "BNB balance of storage should be 0"
      );
      expect(tokenDepositNew.toString()).to.be.eql(
        "0",
        "token deposit of storage should be 0"
      );
      expect(balanceBNBLogicNew.toString()).to.be.eql(
        "0",
        "BNB balance of logic should be 0"
      );
      expect(tokenDepositTotalNew.toString()).to.be.eql(
        "0",
        "token deposit total of storage should be 0"
      );
    });
  });

  describe("Token Available for strategy (USDC)", async () => {
    before(async () => {
      await usdc
        .connect(owner)
        .approve(storage.address, ethers.utils.parseEther("1000000000000"));
    });

    describe("Available division and check Avaliable limit", async () => {
      it("Deposit 100", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("100"), usdc.address);
      });

      it("Available should be 70, 30", async () => {
        balance = await multiLogicProxy.getTokenAvailable(
          usdc.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("63").toString(),
          "LBF : 63"
        );
        balance = await multiLogicProxy.getTokenAvailable(
          usdc.address,
          lblLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("27").toString(),
          "LBL : 27"
        );
      });

      it("Can't take 64 for LBF", async () => {
        await lbfLogic
          .takeTokenFromStorage(ethers.utils.parseEther("64"), usdc.address)
          .should.be.revertedWith("M6");
      });

      it("Can take 63 for LBF", async () => {
        await lbfLogic.takeTokenFromStorage(
          ethers.utils.parseEther("63"),
          usdc.address
        ).should.not.be.reverted;
      });

      it("Withdraw 100", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("100"), usdc.address);
      });
    });

    describe("TotalDeposited : 0 - 10 000", async () => {
      before(async () => {
        await usdt
          .connect(owner)
          .approve(storage.address, ethers.utils.parseEther("1000000000000"));
      });

      it("Deposit 1000 : 1000", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("1000"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(1000), "LBF : 900");
      });

      it("Deposit 1000 : 2000", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("1000"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(2000), "LBF : 1800");
      });

      it("Withdraw 500 : 1500", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("500"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(1500), "LBF : 1350");
      });
    });

    describe("TotalDeposited : 10 000 - 300 000", async () => {
      it("Deposit 8600 : 10100", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("8600"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(10100),
          "LBF : 9948.5"
        );
      });

      it("Deposit 10000 : 20100", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("10000"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(20100),
          "LBF : 19798.5"
        );
      });

      it("Withdraw 20000 : 100", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("20000"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(100), "LBF : 90");
      });

      it("deposit 9800 : 9900", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("9800"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(9900), "LBF : 8910");
      });

      it("deposit 110 : 10010", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("110"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(10010),
          "LBF : 9859.85"
        );
      });

      it("withdraw 110 : 9900", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("110"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(9900), "LBF : 8910");
      });

      it("Deposit 290 000 : 299 900", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("290000"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(299900),
          "LBF : 295,401.5"
        );
      });
    });

    describe("TotalDeposited : 300 000 -", async () => {
      it("Deposit 110 : 300 010", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("110"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(300010),
          "LBF : 295010"
        );
      });

      it("Withdraw 110 : 299 900", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("110"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(299900),
          "LBF : 295010"
        );
      });

      it("Deposit 10 200 : 310 100", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("10200"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(310100),
          "LBF : 305100"
        );
      });

      it("Withdraw 100 : 310 000", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("100"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(310000),
          "LBF : 305000"
        );
      });

      it("Withdraw 100 000 : 210 000", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("100000"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(210000),
          "LBF : 206850"
        );
      });

      it("Withdraw 200 000 : 10 000", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("200000"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(10000),
          "LBF : 9000"
        );
      });
    });

    describe("Take Token and withdraw", async () => {
      it("Take 8000 from storage to Logic", async () => {
        await lbfLogic
          .connect(owner)
          .takeTokenFromStorage(ethers.utils.parseEther("8000"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("1000").toString(),
          "LBF : 1000"
        );
      });

      it("Withdraw 1500", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("1500"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "LBF : 0"
        );
      });

      it("Deposit 100", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("100"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "LBF : 0"
        );
      });

      it("Deposit 1000", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("1000"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("640").toString(),
          "LBF : 640"
        );
      });

      it("Withdraw 4600", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("4600"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "LBF : 0"
        );

        balance = await storage.connect(owner).getTokenDeposited(usdt.address);
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("5000").toString(),
          "Deposited : 5000"
        );

        balance = await storage.connect(owner).getTokenBalance(usdt.address);
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "Storage Balance : 0"
        );
      });

      it("Withdraw 5000", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("5000"), usdt.address);

        balance = await multiLogicProxy.getTokenAvailable(
          usdt.address,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "LBF : 0"
        );

        balance = await storage.connect(owner).getTokenDeposited(usdt.address);
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "Deposited : 0"
        );

        balance = await storage.connect(owner).getTokenBalance(usdt.address);
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "Storage Balance : 0"
        );
      });
    });
  });

  describe("Token Available for strategy (BNB)", async () => {
    before(async () => {
      tx = await multiLogicProxy
        .connect(owner)
        .setPercentages(ZERO_ADDRESS, [7000, 3000]);
      await tx.wait(1);
    });

    describe("Available division and check Avaliable limit", async () => {
      it("Deposit 100", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("100"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("100"),
          });
      });

      it("Available should be 70, 30", async () => {
        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("63").toString(),
          "LBF : 63"
        );
        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lblLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("27").toString(),
          "LBL : 27"
        );
      });

      it("Can't take 64 for LBF", async () => {
        await lbfLogic
          .takeTokenFromStorage(ethers.utils.parseEther("64"), ZERO_ADDRESS)
          .should.be.revertedWith("M6");
      });

      it("Can take 63 for LBF", async () => {
        await lbfLogic.takeTokenFromStorage(
          ethers.utils.parseEther("63"),
          ZERO_ADDRESS
        ).should.not.be.reverted;
      });

      it("Withdraw 100", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("100"), ZERO_ADDRESS);

        expect(
          (await ethers.provider.getBalance(storage.address)).toString()
        ).to.be.eql("0", "balance is 0");
        expect(
          (
            await multiLogicProxy.getTokenAvailable(
              ZERO_ADDRESS,
              lblLogic.address
            )
          ).toString()
        ).to.be.eql("0", "balance is 0");
        expect(
          (
            await multiLogicProxy.getTokenAvailable(
              ZERO_ADDRESS,
              lbfLogic.address
            )
          ).toString()
        ).to.be.eql("0", "balance is 0");
      });
    });

    describe("TotalDeposited : 0 - 10 000", async () => {
      before(async () => {
        tx = await multiLogicProxy
          .connect(owner)
          .setPercentages(ZERO_ADDRESS, [10000, 0]);
        await tx.wait(1);
      });

      it("Deposit 1000 : 1000", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("1000"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("1000"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(1000), "LBF : 900");
      });

      it("Deposit 1000 : 2000", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("1000"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("1000"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(2000), "LBF : 1800");
      });

      it("Withdraw 500 : 1500", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("500"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(1500), "LBF : 1350");
      });
    });

    describe("TotalDeposited : 10 000 - 300 000", async () => {
      it("Deposit 8600 : 10100", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("8600"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("8600"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );

        expect(balance.toString()).to.be.eql(
          calcAvailable(10100),
          "LBF : 9948.5"
        );
      });

      it("Deposit 10000 : 20100", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("10000"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("10000"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(20100),
          "LBF : 19798.5"
        );
      });

      it("Withdraw 20000 : 100", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("20000"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(100), "LBF : 90");
      });

      it("deposit 9800 : 9900", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("9800"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("9800"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(9900), "LBF : 8910");
      });

      it("deposit 110 : 10010", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("110"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("110"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(10010),
          "LBF : 9859.85"
        );
      });

      it("withdraw 110 : 9900", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("110"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(calcAvailable(9900), "LBF : 8910");
      });

      it("Deposit 290 000 : 299 900", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("290000"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("290000"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(299900),
          "LBF : 295,401.5"
        );
      });
    });

    describe("TotalDeposited : 300 000 -", async () => {
      it("Deposit 110 : 300 010", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("110"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("110"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(300010),
          "LBF : 295010"
        );
      });

      it("Withdraw 110 : 299 900", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("110"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(299900),
          "LBF : 295010"
        );
      });

      it("Deposit 10 200 : 310 100", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("10200"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("10200"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(310100),
          "LBF : 305100"
        );
      });

      it("Withdraw 100 : 310 000", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("100"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(310000),
          "LBF : 305000"
        );
      });

      it("Withdraw 100 000 : 210 000", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("100000"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(210000),
          "LBF : 206850"
        );
      });

      it("Withdraw 200 000 : 10 000", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("200000"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          calcAvailable(10000),
          "LBF : 9000"
        );
      });
    });

    describe("Take Token and withdraw", async () => {
      it("Take 8000 from storage to Logic", async () => {
        await lbfLogic
          .connect(owner)
          .takeTokenFromStorage(ethers.utils.parseEther("8000"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("1000").toString(),
          "LBF : 1000"
        );
      });

      it("Withdraw 1500", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("1500"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "LBF : 0"
        );
      });

      it("Deposit 100", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("100"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("100"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "LBF : 0"
        );
      });

      it("Deposit 1000", async () => {
        await storage
          .connect(owner)
          .deposit(ethers.utils.parseEther("1000"), ZERO_ADDRESS, {
            value: ethers.utils.parseEther("1000"),
          });

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("640").toString(),
          "LBF : 640"
        );
      });

      it("Withdraw 4600", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("4600"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "LBF : 0"
        );

        balance = await storage.connect(owner).getTokenDeposited(ZERO_ADDRESS);
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("5000").toString(),
          "Deposited : 5000"
        );

        balance = await storage.connect(owner).getTokenBalance(ZERO_ADDRESS);
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "Storage Balance : 0"
        );
      });

      it("Withdraw 5000", async () => {
        await storage
          .connect(owner)
          .withdraw(ethers.utils.parseEther("5000"), ZERO_ADDRESS);

        balance = await multiLogicProxy.getTokenAvailable(
          ZERO_ADDRESS,
          lbfLogic.address
        );
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "LBF : 0"
        );

        balance = await storage.connect(owner).getTokenDeposited(ZERO_ADDRESS);
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "Deposited : 0"
        );

        balance = await storage.connect(owner).getTokenBalance(ZERO_ADDRESS);
        expect(balance.toString()).to.be.eql(
          ethers.utils.parseEther("0").toString(),
          "Storage Balance : 0"
        );
      });
    });
  });
};
