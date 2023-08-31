/*******************************************
 * Test on BSC Mainnet
 * Before run test, deploy storage, logic, aggregator contract on mainnet
 * Owner should have at least 1 USDT
 *******************************************/

import dotenv from "dotenv";
import {cEthAbi, cErcAbi} from "../../data/contracts_abi/compound.json";
import {erc20Abi} from "../../data/contracts_abi/erc20.json";
import {
  StorageV3,
  LogicV3,
  StorageV3__factory,
  LogicV3__factory,
  LendBorrowFarmStrategyV2,
  LendBorrowFarmStrategyV2__factory,
  LendBorrowFarmingPair,
  LendBorrowFarmingPair__factory,
  MultiLogic,
  MultiLogic__factory,
} from "../../typechain-types";
import {ethers} from "hardhat";
import {expect, assert} from "chai";
import {time} from "@openzeppelin/test-helpers";
import {ADDRESS_COLLECTION, PLATFORM} from "../../data/addresses.json";
import {sleep, logValue} from "../../utils/helpers";

dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(
  process.env.TESTNET_BSC_PROVIDER_URL,
  {name: "binance", chainId: 97}
);

// Load Addresses
const ADDRESSES = ADDRESS_COLLECTION.bscTestnet;
const platform = PLATFORM["bscTestnet"];
const blidAddress = platform.blid;
const expenseAddress = platform.expenses;

// Your Ethereum wallet private key
const owner = process.env.DEPLOYER_PRIVATE_KEY
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider)
  : ethers.Wallet.createRandom();
const other = process.env.DEPLOYER_PRIVATE_KEY_TEST
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY_TEST!, provider)
  : ethers.Wallet.createRandom();

// Mainnet deployed Contract address
const lbfLogicAddress = process.env.LBF_LOGIC_PROXY_ADDRESS!;
const lbfStrategyAddress = process.env.LBF_STRATEGY_PROXY_ADDRESS!;
const lbfFarmingPairAddress = process.env.LBF_PAIR_PROXY_ADDRESS!;
const lblLogicAddress = process.env.LBL_LOGIC_PROXY_ADDRESS!;
const lblStrategyAddress = process.env.LBL_STRATEGY_PROXY_ADDRESS!;
const storageAddress = process.env.STORAGE_PROXY_ADDRESS!;
const multiLogicProxyAddress = process.env.MULTILOGIC_PROXY_ADDRESS!;

// Test Environment
const SWAP_ROUTER_ADDRESS = ADDRESSES.PancakeRouter;
const SWAP_MASTER_ADDRESS = ADDRESSES.PancakeMasterV2;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const BLID = new ethers.Contract(blidAddress, erc20Abi, owner);

// Initialize vTokens Contract
const USDT = new ethers.Contract(
  ADDRESSES.Token.USDT.Underlying,
  erc20Abi,
  owner
);
const xUSDT = new ethers.Contract(ADDRESSES.Token.USDT.Venus, cErcAbi, owner);
const USDC = new ethers.Contract(
  ADDRESSES.Token.USDC.Underlying,
  erc20Abi,
  owner
);
const xUSDC = new ethers.Contract(ADDRESSES.Token.USDC.Venus, cErcAbi, owner);
const SXP = new ethers.Contract(
  ADDRESSES.Token.SXP.Underlying,
  erc20Abi,
  owner
);
const xSXP = new ethers.Contract(ADDRESSES.Token.SXP.Venus, cErcAbi, owner);
const BUSD = new ethers.Contract(
  ADDRESSES.Token.BUSD.Underlying,
  erc20Abi,
  owner
);
const xBUSD = new ethers.Contract(ADDRESSES.Token.BUSD.Venus, cErcAbi, owner);
const XVS = new ethers.Contract(
  ADDRESSES.Token.XVS.Underlying,
  erc20Abi,
  owner
);
const xXVS = new ethers.Contract(ADDRESSES.Token.XVS.Venus, cErcAbi, owner);
const BNB = new ethers.Contract(
  ADDRESSES.Token.BNB.Underlying,
  erc20Abi,
  owner
);
const xBNB = new ethers.Contract(ADDRESSES.Token.BNB.Venus, cEthAbi, owner);

const LP_BUSD_SXP = new ethers.Contract(
  ADDRESSES.SWAP.Pancake.BUSD_SXP.LP,
  erc20Abi,
  owner
);
const LP_SXP_BNB = new ethers.Contract(
  ADDRESSES.SWAP.Pancake.SXP_BNB.LP,
  erc20Abi,
  owner
);
const LP_BUSD_SXP_POOLID = ADDRESSES.SWAP.Pancake.BUSD_SXP.PoolIDV1;
const LP_SXP_BNB_POOLID = ADDRESSES.SWAP.Pancake.SXP_BNB.PoolIDV1;

// Variables for deployed contract
let tx,
  storage: StorageV3,
  lbfLogic: LogicV3,
  lbfStrategy: LendBorrowFarmStrategyV2,
  lbfFarmingPair: LendBorrowFarmingPair,
  multiLogicProxy: MultiLogic;

let startTime: typeof time;

export const lbf_strategyV2_testnet = () => {
  before(async () => {
    lbfLogic = LogicV3__factory.connect(lbfLogicAddress, owner) as LogicV3;

    lbfStrategy = LendBorrowFarmStrategyV2__factory.connect(
      lbfStrategyAddress,
      owner
    );

    lbfFarmingPair = LendBorrowFarmingPair__factory.connect(
      lbfFarmingPairAddress,
      owner
    );

    storage = StorageV3__factory.connect(storageAddress, owner) as StorageV3;

    multiLogicProxy = MultiLogic__factory.connect(
      multiLogicProxyAddress,
      owner
    ) as MultiLogic;
  });

  xdescribe("Preparation", async () => {
    xdescribe("MuliLogicProxy", async () => {
      it("Set Strategy address", async () => {
        tx = await multiLogicProxy.connect(owner).initStrategies(
          ["LBF", "LBL"],
          [
            {
              logicContract: lbfLogicAddress,
              strategyContract: lbfStrategyAddress,
            },
            {
              logicContract: lblLogicAddress,
              strategyContract: lbfStrategyAddress,
            },
          ]
        );
        await tx.wait(1);
      });

      it("Set Percentages, USDT [7000, 3000], BNB [6000, 4000]", async () => {
        tx = await multiLogicProxy
          .connect(owner)
          .setPercentages(USDT.address, [7000, 3000]);
        await tx.wait(1);

        tx = await multiLogicProxy
          .connect(owner)
          .setPercentages(ZERO_ADDRESS, [6000, 4000]);
        await tx.wait(1);
      });
    });

    describe("Add USDT, BNB with Strategy", async () => {
      it("Add Lending Tokens (USDT/xUSDT)", async () => {
        tx = await lbfStrategy
          .connect(owner)
          .addLendingToken(USDT.address, xUSDT.address);
        await tx.wait(1);
      });

      it("Add Lending Tokens (BNB/xBNB)", async () => {
        tx = await lbfStrategy
          .connect(owner)
          .addLendingToken(ZERO_ADDRESS, xBNB.address);
        await tx.wait(1);
      });

      it("Add Lending Tokens (SXP/xSXP)", async () => {
        tx = await lbfStrategy
          .connect(owner)
          .addLendingToken(SXP.address, xSXP.address);
        await tx.wait(1);
      });

      it("Add Lending Tokens (BUSD/xBUSD)", async () => {
        tx = await lbfStrategy
          .connect(owner)
          .addLendingToken(BUSD.address, xBUSD.address);
        await tx.wait(1);
      });

      xit("Cannot Add Lending Tokens (xUSDT/USDT) again", async () => {
        await expect(
          lbfStrategy
            .connect(owner)
            .addLendingToken(USDT.address, xUSDT.address)
        ).to.be.revertedWith("F6");
      });
    });

    xdescribe("ADD borrow tokens to Logic", async () => {
      it("Add Tokens (BUSD/xBUSD)", async () => {
        tx = await lbfLogic
          .connect(owner)
          .addXTokens(BUSD.address, xBUSD.address, 0);
        await tx.wait(1);
      });

      it("Add Tokens (USDC/xUSDC)", async () => {
        tx = await lbfLogic
          .connect(owner)
          .addXTokens(USDC.address, xUSDC.address, 0);
        await tx.wait(1);
      });

      it("Add Tokens (SXP/xSXP)", async () => {
        tx = await lbfLogic
          .connect(owner)
          .addXTokens(SXP.address, xSXP.address, 0);
        await tx.wait(1);
      });
    });

    xdescribe("Approve LP tokens", async () => {
      it("Approve BUSD_SXP LP Token", async () => {
        tx = await lbfLogic
          .connect(owner)
          .approveTokenForSwap(LP_BUSD_SXP.address);
        await tx.wait(1);
      });

      it("Approve SXP_BNB LP Token", async () => {
        tx = await lbfLogic
          .connect(owner)
          .approveTokenForSwap(LP_SXP_BNB.address);
        await tx.wait(1);
      });
    });

    xdescribe("Approve farming Rewards tokens", async () => {
      it("Approve CAKE Token", async () => {
        tx = await lbfLogic
          .connect(owner)
          .approveTokenForSwap(ADDRESSES.Token.CAKE.Underlying);
        await tx.wait(1);
      });
    });
  });

  xdescribe("Initialization", async () => {
    describe("Set pathToSwapRewardsToBNB", async () => {
      xit("Length of pathToSwapRewardsToBNB should be more than 2", async () => {
        const tx = await lbfStrategy
          .connect(owner)
          .setPathToSwapRewardsToBNB([USDT.address])
          .should.be.revertedWith("F16");
      });

      xit("pathToSwapRewardsToBNB should start with XVS token", async () => {
        const tx = await lbfStrategy
          .connect(owner)
          .setPathToSwapRewardsToBNB([USDT.address, BNB.address])
          .should.be.revertedWith("F17");
      });

      it("Set pathToSwapRewardsToBNB as XVS-BNB", async () => {
        const tx = await lbfStrategy
          .connect(owner)
          .setPathToSwapRewardsToBNB([
            ADDRESSES.Token.XVS.Underlying,
            ADDRESSES.Token.BNB.Underlying,
          ]);
        await tx.wait(1);
      });
    });

    describe("Set pathToSwapBNBToBLID", async () => {
      xit("Length of pathToSwapBNBToBLID should be more than 2", async () => {
        const tx = await lbfStrategy
          .connect(owner)
          .setPathToSwapBNBToBLID([USDT.address])
          .should.be.revertedWith("F16");
      });

      xit("pathToSwapBNBToBLID should end with BLID token", async () => {
        const tx = await lbfStrategy
          .connect(owner)
          .setPathToSwapBNBToBLID([
            ADDRESSES.Token.XVS.Underlying,
            USDT.address,
          ])
          .should.be.revertedWith("F18");
      });

      it("Set pathToSwapBNBToBLID as BNB-BLID", async () => {
        const tx = await lbfStrategy
          .connect(owner)
          .setPathToSwapBNBToBLID([
            ADDRESSES.Token.BNB.Underlying,
            BLID.address,
          ]);
        await tx.wait(1);
      });
    });

    describe("FarmingPair & Percentage", async () => {
      it("Set farmingPair", async () => {
        tx = await lbfFarmingPair.connect(owner).setFarmingPairs([
          {
            tokenA: BUSD.address,
            tokenB: SXP.address,
            xTokenA: xBUSD.address,
            xTokenB: xSXP.address,
            swap: SWAP_ROUTER_ADDRESS,
            swapMaster: SWAP_MASTER_ADDRESS,
            lpToken: LP_BUSD_SXP.address,
            poolID: LP_BUSD_SXP_POOLID,
            rewardsToken: ADDRESSES.Token.CAKE.Underlying,
            path: [
              [
                ADDRESSES.Token.BUSD.Underlying,
                ADDRESSES.Token.USDT.Underlying,
              ],
              [ADDRESSES.Token.BUSD.Underlying, ADDRESSES.Token.BNB.Underlying],
            ],
            pathTokenA2BNB: [
              ADDRESSES.Token.BUSD.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            pathTokenB2BNB: [
              ADDRESSES.Token.SXP.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            pathRewards2BNB: [
              ADDRESSES.Token.CAKE.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            percentage: 0,
          },
          {
            tokenA: SXP.address,
            tokenB: ZERO_ADDRESS,
            xTokenA: xSXP.address,
            xTokenB: xBNB.address,
            swap: SWAP_ROUTER_ADDRESS,
            swapMaster: SWAP_MASTER_ADDRESS,
            lpToken: LP_SXP_BNB.address,
            poolID: LP_SXP_BNB_POOLID,
            rewardsToken: ADDRESSES.Token.CAKE.Underlying,
            path: [
              [ADDRESSES.Token.SXP.Underlying, ADDRESSES.Token.USDT.Underlying],
              [ADDRESSES.Token.SXP.Underlying, ADDRESSES.Token.BNB.Underlying],
            ],
            pathTokenA2BNB: [
              ADDRESSES.Token.SXP.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            pathTokenB2BNB: [
              ADDRESSES.Token.BNB.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            pathRewards2BNB: [
              ADDRESSES.Token.CAKE.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            percentage: 0,
          },
        ]);
      });

      it("Set Percentage BUSD_SXP : 7000, SXP_BNB : 3000", async () => {
        tx = await lbfFarmingPair.connect(owner).setPercentages([7000, 3000]);
        await tx.wait(1);
      });
    });
  });

  xdescribe("Step 1 - Deposit to Storage", async () => {
    it("Add USDT to storage", async () => {
      tx = await storage
        .connect(owner)
        .addToken(USDT.address, ADDRESSES.CHAINLINK.USDT);
      await tx.wait(1);
    });

    it("Add BNB to storage", async () => {
      tx = await storage
        .connect(owner)
        .addToken(ZERO_ADDRESS, ADDRESSES.CHAINLINK.BNB);
      await tx.wait(1);
    });

    it("Approve 10 USDT for storage", async () => {
      tx = await USDT.connect(owner).approve(storage.address, 10000000);
      await tx.wait(1);
    });

    it("Deposit 10 USDT from owner to storage", async () => {
      tx = await storage.connect(owner).deposit(10000000, USDT.address);
      await tx.wait(1);
    });

    it("Deposit 0.1 BNB from owner to storage", async () => {
      const tx = await storage
        .connect(owner)
        .deposit(ethers.utils.parseEther("0.1"), ZERO_ADDRESS, {
          from: owner.address,
          value: ethers.utils.parseEther("0.1").toString(),
        });
      await tx.wait(1);
    });
  });

  xdescribe("Step 2 - LendToken", async () => {
    it("Lend BNB, USDT all", async () => {
      let balanceUSDTLogic = await USDT.balanceOf(lbfLogic.address);
      let balanceBNBLogic = await provider.getBalance(lbfLogic.address);
      let balancexUSDTLogic = await xUSDT.balanceOf(lbfLogic.address);
      let balancexBNBLogic = await xBNB.balanceOf(lbfLogic.address);

      let balanceUSDTStorage = await USDT.balanceOf(storage.address);
      let balanceBNBStorage = await provider.getBalance(storage.address);

      tx = await lbfStrategy.connect(owner).lendToken();
      await tx.wait(1);

      let balanceUSDTLogicNew = await USDT.balanceOf(lbfLogic.address);
      let balanceBNBLogicNew = await provider.getBalance(lbfLogic.address);
      let balancexUSDTLogicNew = await xUSDT.balanceOf(lbfLogic.address);
      let balancexBNBLogicNew = await xBNB.balanceOf(lbfLogic.address);

      let balanceUSDTStorageNew = await USDT.balanceOf(storage.address);
      let balanceBNBStorageNew = await provider.getBalance(storage.address);

      expect(balanceUSDTLogicNew.toString()).to.be.eql(
        balanceUSDTLogic.toString(),
        "USDT balance of logic should be unchanged"
      );
      expect(balanceBNBLogicNew.toString()).to.be.eql(
        balanceBNBLogic.toString(),
        "BNB balance of logic should be unchanged"
      );
      expect(balancexUSDTLogicNew.gt(balancexUSDTLogic)).to.be.eql(
        true,
        "xUSDT should be increased"
      );
      expect(balancexBNBLogicNew.gt(balancexBNBLogic)).to.be.eql(
        true,
        "xBNB should be increased"
      );

      expect(
        balanceUSDTStorage.sub(balanceUSDTStorageNew).toString()
      ).to.be.eql(
        "6300000",
        "USDT balance of storage should be decreased by 6.3"
      );
      expect(balanceBNBStorage.sub(balanceBNBStorageNew).toString()).to.be.eql(
        ethers.utils.parseEther("0.054").toString(),
        "BNB balance of storage should be decreased by 0.054"
      );
    });
  });

  describe("Step 3 - build", async () => {
    xit("Only admin can process build", async () => {
      await expect(
        lbfStrategy.connect(other).build(ethers.utils.parseEther("0.0001"))
      ).to.revertedWith("OA2");
    });

    xit("Cannot build too much", async () => {
      await expect(
        lbfStrategy.connect(owner).build(ethers.utils.parseEther("9999999999"))
      ).to.revertedWith("F13");
    });

    it("Build with 10 USD", async () => {
      let balance_BUSD_SXP_Masterchef = await LP_BUSD_SXP.balanceOf(
        SWAP_MASTER_ADDRESS
      );
      let balance_SXP_BNB_Masterchef = await LP_SXP_BNB.balanceOf(
        SWAP_MASTER_ADDRESS
      );

      tx = await lbfStrategy
        .connect(owner)
        .build(ethers.utils.parseEther("10"));
      await tx.wait(1);

      let balance_BUSD_SXP_MasterchefNew = await LP_BUSD_SXP.balanceOf(
        SWAP_MASTER_ADDRESS
      );
      let balance_SXP_BNB_MasterchefNew = await LP_SXP_BNB.balanceOf(
        SWAP_MASTER_ADDRESS
      );

      expect(
        balance_BUSD_SXP_MasterchefNew.gt(balance_BUSD_SXP_Masterchef)
      ).to.be.eql(true, "BUSD_SXP balance of Masterchef should be increased");
      expect(
        balance_SXP_BNB_MasterchefNew.gt(balance_SXP_BNB_Masterchef)
      ).to.be.eql(true, "SXP_BNB balance of Masterchef should be increased");
    });

    xdescribe("RepayBorrow", async () => {
      it("BUSD", async () => {
        let balance = await BUSD.balanceOf(lbfLogic.address);
        tx = await lbfLogic.repayBorrow(xBUSD.address, balance);
        await tx.wait(1);
      });

      xit("SXP", async () => {
        let balance = await SXP.balanceOf(lbfLogic.address);
        tx = await lbfLogic.repayBorrow(xSXP.address, balance);
        await tx.wait(1);
      });

      it("BNB", async () => {
        let balance = await provider.getBalance(lbfLogic.address);
        tx = await lbfLogic.repayBorrow(xBNB.address, balance);
        await tx.wait(1);
      });
    });
  });

  xdescribe("Step 4 - Claim", async () => {
    xit("Only Owner or Admin can process Claim", async () => {
      const tx = await lbfStrategy
        .connect(other)
        .claimRewards(0)
        .should.be.revertedWith("OA2");
    });

    xit("Claim Venus Rewards", async () => {
      await sleep(10000);
      let BLIDOwnerBalance = await storage.balanceEarnBLID(owner.address);
      let BLIDStorageBalance = await BLID.balanceOf(storage.address);
      let BLIDExpenseBalance = await BLID.balanceOf(expenseAddress);

      const tx = await lbfStrategy.connect(owner).claimRewards(1);
      await tx.wait(1);

      let BLIDOwnerBalanceNew = await storage.balanceEarnBLID(owner.address);
      let BLIDStorageBalanceNew = await BLID.balanceOf(storage.address);
      let BLIDExpenseBalanceNew = await BLID.balanceOf(expenseAddress);

      assert.equal(
        BLIDOwnerBalanceNew.gt(BLIDOwnerBalance),
        true,
        "BLID balance of Owner should be increased"
      );
      assert.equal(
        BLIDStorageBalanceNew.gt(BLIDStorageBalance),
        true,
        "BLID balance of Storage should be increased"
      );
      assert.equal(
        BLIDExpenseBalanceNew.gt(BLIDExpenseBalance),
        true,
        "BLID balance of Expense should be increased"
      );
    });

    it("Claim Farm Rewards", async () => {
      await sleep(10000);
      let BLIDOwnerBalance = await storage.balanceEarnBLID(owner.address);
      let BLIDStorageBalance = await BLID.balanceOf(storage.address);
      let BLIDExpenseBalance = await BLID.balanceOf(expenseAddress);

      const tx = await lbfStrategy.connect(owner).claimRewards(2);
      await tx.wait(1);

      let BLIDOwnerBalanceNew = await storage.balanceEarnBLID(owner.address);
      let BLIDStorageBalanceNew = await BLID.balanceOf(storage.address);
      let BLIDExpenseBalanceNew = await BLID.balanceOf(expenseAddress);

      assert.equal(
        BLIDOwnerBalanceNew.gt(BLIDOwnerBalance),
        true,
        "BLID balance of Owner should be increased"
      );
      assert.equal(
        BLIDStorageBalanceNew.gt(BLIDStorageBalance),
        true,
        "BLID balance of Storage should be increased"
      );
      assert.equal(
        BLIDExpenseBalanceNew.gt(BLIDExpenseBalance),
        true,
        "BLID balance of Expense should be increased"
      );
    });

    after(async () => {
      logValue("BLID Award", await storage.balanceEarnBLID(owner.address));
    });
  });

  xdescribe("Step 5 - destroy", async () => {
    xit("Only admin can process destory", async () => {
      await expect(lbfStrategy.connect(other).destroy(5000)).to.revertedWith(
        "OA2"
      );
    });

    xit("The percentage should be less than 10000", async () => {
      await expect(lbfStrategy.connect(owner).destroy(50000)).to.revertedWith(
        "F11"
      );
    });

    xit("Destroy 80%", async () => {
      let balance_BUSD_SXP_Masterchef = await LP_BUSD_SXP.balanceOf(
        SWAP_MASTER_ADDRESS
      );
      let balance_SXP_BNB_Masterchef = await LP_SXP_BNB.balanceOf(
        SWAP_MASTER_ADDRESS
      );

      tx = await lbfStrategy.connect(owner).destroy(8000);
      await tx.wait(1);

      let balance_BUSD_SXP_MasterchefNew = await LP_BUSD_SXP.balanceOf(
        SWAP_MASTER_ADDRESS
      );
      let balance_SXP_BNB_MasterchefNew = await LP_SXP_BNB.balanceOf(
        SWAP_MASTER_ADDRESS
      );

      expect(
        balance_BUSD_SXP_MasterchefNew.lt(balance_BUSD_SXP_Masterchef)
      ).to.be.eql(true, "BUSD_SXP balance of Masterchef should be decreased");
      expect(
        balance_SXP_BNB_MasterchefNew.lt(balance_SXP_BNB_Masterchef)
      ).to.be.eql(true, "SXP_BNB balance of Masterchef should be decreased");
    });

    it("Destroy 100%", async () => {
      let balance_BUSD_SXP_Masterchef = await LP_BUSD_SXP.balanceOf(
        SWAP_MASTER_ADDRESS
      );
      let balance_SXP_BNB_Masterchef = await LP_SXP_BNB.balanceOf(
        SWAP_MASTER_ADDRESS
      );

      tx = await lbfStrategy.connect(owner).destroy(10000);
      await tx.wait(1);

      let balance_BUSD_SXP_MasterchefNew = await LP_BUSD_SXP.balanceOf(
        SWAP_MASTER_ADDRESS
      );
      let balance_SXP_BNB_MasterchefNew = await LP_SXP_BNB.balanceOf(
        SWAP_MASTER_ADDRESS
      );

      expect(
        balance_BUSD_SXP_MasterchefNew.lt(balance_BUSD_SXP_Masterchef)
      ).to.be.eql(true, "BUSD_SXP balance of Masterchef should be decreased");
      expect(
        balance_SXP_BNB_MasterchefNew.lt(balance_SXP_BNB_Masterchef)
      ).to.be.eql(true, "SXP_BNB balance of Masterchef should be decreased");
    });
  });

  xdescribe("Step 6 - destroyAll", async () => {
    it("Call destroyAll", async () => {
      await sleep(10000);
      let BLIDOwnerBalance = await storage.balanceEarnBLID(owner.address);
      let BLIDStorageBalance = await BLID.balanceOf(storage.address);
      let BLIDExpenseBalance = await BLID.balanceOf(expenseAddress);

      const tx = await lbfStrategy.connect(owner).destroyAll();
      await tx.wait(1);

      let BLIDOwnerBalanceNew = await storage.balanceEarnBLID(owner.address);
      let BLIDStorageBalanceNew = await BLID.balanceOf(storage.address);
      let BLIDExpenseBalanceNew = await BLID.balanceOf(expenseAddress);

      let BorrowBUSD = await xBUSD.borrowBalanceStored(lbfLogic.address);
      let BorrowSXP = await xSXP.borrowBalanceStored(lbfLogic.address);
      let BorrowBNB = await xBNB.borrowBalanceStored(lbfLogic.address);

      // Check BLID increated
      assert.equal(
        BLIDOwnerBalanceNew.gt(BLIDOwnerBalance),
        true,
        "BLID balance of Owner should be increased"
      );
      assert.equal(
        BLIDStorageBalanceNew.gt(BLIDStorageBalance),
        true,
        "BLID balance of Storage should be increased"
      );
      assert.equal(
        BLIDExpenseBalanceNew.gt(BLIDExpenseBalance),
        true,
        "BLID balance of Expense should be increased"
      );

      // Check borrow amount
      assert.equal(BorrowBUSD.toString(), "0", "BUSD Borrow should be 0");
      assert.equal(BorrowSXP.toString(), "0", "SXP Borrow should be 0");
      assert.equal(BorrowBNB.toString(), "0", "BNB Borrow should be 0");
    });
  });

  xdescribe("Step 7 - returnAllTokensToStorage", async () => {
    it("Call returnAllTokensToStorage", async () => {
      await sleep(10000);
      let BLIDOwnerBalance = await storage.balanceEarnBLID(owner.address);
      let BLIDStorageBalance = await BLID.balanceOf(storage.address);
      let BLIDExpenseBalance = await BLID.balanceOf(expenseAddress);

      let balanceUSDTStorage = await USDT.balanceOf(storage.address);
      let balanceBNBStorage = await provider.getBalance(storage.address);

      const tx = await lbfStrategy.connect(owner).returnAllTokensToStorage();
      await tx.wait(1);

      let BLIDOwnerBalanceNew = await storage.balanceEarnBLID(owner.address);
      let BLIDStorageBalanceNew = await BLID.balanceOf(storage.address);
      let BLIDExpenseBalanceNew = await BLID.balanceOf(expenseAddress);

      let BorrowBUSD = await xBUSD.borrowBalanceStored(lbfLogic.address);
      let BorrowSXP = await xSXP.borrowBalanceStored(lbfLogic.address);
      let BorrowBNB = await xBNB.borrowBalanceStored(lbfLogic.address);

      let balanceXBUSD = await xBUSD.balanceOf(lbfLogic.address);
      let balanceXSXP = await xSXP.balanceOf(lbfLogic.address);
      let balanceXBNB = await xBNB.balanceOf(lbfLogic.address);

      let balanceUSDTStorageNew = await USDT.balanceOf(storage.address);
      let balanceBNBStorageNew = await provider.getBalance(storage.address);

      // Check BLID increated
      assert.equal(
        BLIDOwnerBalanceNew.gt(BLIDOwnerBalance),
        true,
        "BLID balance of Owner should be increased"
      );
      assert.equal(
        BLIDStorageBalanceNew.gt(BLIDStorageBalance),
        true,
        "BLID balance of Storage should be increased"
      );
      assert.equal(
        BLIDExpenseBalanceNew.gt(BLIDExpenseBalance),
        true,
        "BLID balance of Expense should be increased"
      );

      // Check borrow amount
      assert.equal(BorrowBUSD.toString(), "0", "BUSD Borrow should be 0");
      assert.equal(BorrowSXP.toString(), "0", "SXP Borrow should be 0");
      assert.equal(BorrowBNB.toString(), "0", "BNB Borrow should be 0");

      // Check xToken amount
      assert.equal(balanceXBUSD.toString(), "0", "xBUSD balance should be 0");
      assert.equal(balanceXSXP.toString(), "0", "xSXP balance should be 0");
      assert.equal(balanceXBNB.toString(), "0", "xBNB balance should be 0");

      // Check token balance on storage
      assert.equal(
        balanceUSDTStorageNew.gt(balanceUSDTStorage),
        true,
        "USDT balance of storage should be increased"
      );
      assert.equal(
        balanceBNBStorageNew.gt(balanceBNBStorage),
        true,
        "BNB balance of storage should be increased"
      );
    });
  });

  xdescribe("Step 8 - withdraw", async () => {
    it("Withdraw 10 USDT from storage to owner", async () => {
      let balanceUSDTOwner = await USDT.balanceOf(owner.address);

      tx = await storage.connect(owner).withdraw("10000000", USDT.address);
      await tx.wait(1);

      let balanceUSDTOwnerNew = await USDT.balanceOf(owner.address);

      expect(balanceUSDTOwner.add("10000000")).to.be.eql(
        balanceUSDTOwnerNew.toString(),
        "USDT balance of owner should be increased by 10"
      );
    });

    xit("Withdraw 0.4 USDT from storage to owner", async () => {
      let balanceUSDTOwner = await USDT.balanceOf(owner.address);

      tx = await storage
        .connect(owner)
        .withdraw(ethers.utils.parseEther("0.4").toString(), USDT.address);
      await tx.wait(1);

      let balanceUSDTOwnerNew = await USDT.balanceOf(owner.address);

      expect(
        balanceUSDTOwner.add(ethers.utils.parseEther("0.4")).toString()
      ).to.be.eql(
        balanceUSDTOwnerNew.toString(),
        "USDT balance of owner should be increased by 0.4"
      );
    });
  });
};
