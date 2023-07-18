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
import {time} from "@openzeppelin/test-helpers";
import {ADDRESS_COLLECTION, PLATFORM} from "../../data/addresses.json";
import {sleep, logValue} from "../../utils/helpers";
import {
  pancakeSwapMasterChefV1Abi,
  pancakeSwapMasterChefV2Abi,
  masterChefAbi,
} from "../../data/contracts_abi/swapMasterChef.json";
import {swapRouterAbi} from "../../data/contracts_abi/swapRouter.json";

dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(
  process.env.MAINNET_BSC_PROVIDER_URL,
  {name: "binance", chainId: 56}
);

// Load Addresses
const ADDRESSES = ADDRESS_COLLECTION.bsc;
const platform = PLATFORM["bsc-beta"];
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
const storageAddress = process.env.STORAGE_PROXY_ADDRESS!;
const multiLogicProxyAddress = process.env.MULTILOGIC_PROXY_ADDRESS!;

// Test Environment
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const BLID = new ethers.Contract(blidAddress, erc20Abi, owner);
// Initialize vTokens Contract
const USDT = new ethers.Contract(
  ADDRESSES.Token.USDT.Underlying,
  erc20Abi,
  owner
);
const xUSDT = new ethers.Contract(ADDRESSES.Token.USDT.Venus, cErcAbi, owner);
const xXRP = new ethers.Contract(ADDRESSES.Token.XRP.Venus, cErcAbi, owner);
const xBNB = new ethers.Contract(ADDRESSES.Token.BNB.Venus, cErcAbi, owner);

const CAKE = new ethers.Contract(
  ADDRESSES.Token.CAKE.Underlying,
  erc20Abi,
  owner
);
const BSW = new ethers.Contract(
  ADDRESSES.Token.BSW.Underlying,
  erc20Abi,
  owner
);
const XRP = new ethers.Contract(
  ADDRESSES.Token.XRP.Underlying,
  erc20Abi,
  owner
);
const LP_XRP_BNB = new ethers.Contract(
  ADDRESSES.SWAP.BiSwap.XRP_BNB.LP,
  erc20Abi,
  owner
);

// Variables for deployed contract
let tx,
  storage: StorageV3,
  lbfLogic: LogicV3,
  lbfStrategy: LendBorrowFarmStrategyV2,
  lbfFarmingPair: LendBorrowFarmingPair,
  multiLogicProxy: MultiLogic;

let startTime: typeof time;

export const lbf_strategyV2_mainnet = () => {
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

  xdescribe("Initialization", async () => {
    xdescribe("FarmingPair & Percentage", async () => {
      it("Set farmingPair", async () => {
        tx = await lbfFarmingPair.connect(owner).setFarmingPairs([
          {
            tokenA: ADDRESSES.Token.XRP.Underlying,
            tokenB: ZERO_ADDRESS,
            xTokenA: ADDRESSES.Token.XRP.Venus,
            xTokenB: ADDRESSES.Token.BNB.Venus,
            swap: ADDRESSES.BiswapRouter,
            swapMaster: ADDRESSES.BiswapMaster,
            lpToken: ADDRESSES.SWAP.BiSwap.XRP_BNB.LP,
            poolID: ADDRESSES.SWAP.BiSwap.XRP_BNB.PoolID,
            rewardsToken: ADDRESSES.Token.BSW.Underlying,
            path: [
              [
                ADDRESSES.Token.XRP.Underlying,
                ADDRESSES.Token.BNB.Underlying,
                ADDRESSES.Token.USDT.Underlying,
              ],
            ],
            pathTokenA2BNB: [
              ADDRESSES.Token.XRP.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            pathTokenB2BNB: [
              ADDRESSES.Token.BNB.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            pathRewards2BNB: [
              ADDRESSES.Token.BSW.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            percentage: 0,
          },
          {
            tokenA: ADDRESSES.Token.BTCB.Underlying,
            tokenB: ZERO_ADDRESS,
            xTokenA: ADDRESSES.Token.BTCB.Venus,
            xTokenB: ADDRESSES.Token.BNB.Venus,
            swap: ADDRESSES.BiswapRouter,
            swapMaster: ADDRESSES.BiswapMaster,
            lpToken: ADDRESSES.SWAP.BiSwap.BTC_BNB.LP,
            poolID: ADDRESSES.SWAP.BiSwap.BTC_BNB.PoolID,
            rewardsToken: ADDRESSES.Token.BSW.Underlying,
            path: [
              [
                ADDRESSES.Token.BTCB.Underlying,
                ADDRESSES.Token.BNB.Underlying,
                ADDRESSES.Token.USDT.Underlying,
              ],
            ],
            pathTokenA2BNB: [
              ADDRESSES.Token.BTCB.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            pathTokenB2BNB: [
              ADDRESSES.Token.BNB.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            pathRewards2BNB: [
              ADDRESSES.Token.BSW.Underlying,
              ADDRESSES.Token.BNB.Underlying,
            ],
            percentage: 0,
          },
          {
            tokenA: ADDRESSES.Token.ETH.Underlying,
            tokenB: ZERO_ADDRESS,
            xTokenA: ADDRESSES.Token.ETH.Venus,
            xTokenB: ADDRESSES.Token.BNB.Venus,
            swap: ADDRESSES.PancakeRouter,
            swapMaster: ADDRESSES.PancakeMasterV2,
            lpToken: ADDRESSES.SWAP.Pancake.ETH_BNB.LP,
            poolID: ADDRESSES.SWAP.Pancake.ETH_BNB.PoolIDV2,
            rewardsToken: ADDRESSES.Token.CAKE.Underlying,
            path: [
              [
                ADDRESSES.Token.ETH.Underlying,
                ADDRESSES.Token.BNB.Underlying,
                ADDRESSES.Token.USDT.Underlying,
              ],
            ],
            pathTokenA2BNB: [
              ADDRESSES.Token.ETH.Underlying,
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
        tx = await lbfFarmingPair
          .connect(owner)
          .setPercentages([3000, 3000, 4000]);
        await tx.wait(1);
      });
    });

    describe("Set pathToSwapRewardsToBNB", async () => {
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
      it("Set pathToSwapBNBToBLID as BNB-BUSD-USDT-BLID", async () => {
        const tx = await lbfStrategy
          .connect(owner)
          .setPathToSwapBNBToBLID([
            ADDRESSES.Token.BNB.Underlying,
            ADDRESSES.Token.BUSD.Underlying,
            ADDRESSES.Token.USDT.Underlying,
            BLID.address,
          ]);
        await tx.wait(1);
      });
    });
  });

  xdescribe("Step 1 - Deposit to Storage", async () => {
    it("Approve 20 USDT for storage", async () => {
      tx = await USDT.connect(owner).approve(
        storage.address,
        "20000000000000000000"
      );
      await tx.wait(1);
    });

    it("Deposit 20 USDT from owner to storage", async () => {
      tx = await storage
        .connect(owner)
        .deposit("20000000000000000000", USDT.address);
      await tx.wait(1);
    });
  });

  xdescribe("Step 2 - LendToken", async () => {
    it("Lend USDT all", async () => {
      tx = await lbfStrategy.connect(owner).lendToken();
      await tx.wait(1);
    });
  });

  xdescribe("Step 3 - build", async () => {
    it("Build with 10 USD", async () => {
      tx = await lbfStrategy
        .connect(owner)
        .build(ethers.utils.parseEther("10"));
      await tx.wait(1);
    });
  });

  xdescribe("Step 4 - Claim", async () => {
    it("Claim Venus Rewards", async () => {
      const tx = await lbfStrategy.connect(owner).claimRewards(1);
      await tx.wait(1);
    });

    xit("Claim Farm Rewards", async () => {
      const tx = await lbfStrategy.connect(owner).claimRewards(2);
      await tx.wait(1);
    });
  });

  xdescribe("Step 5 - Destroy partly", async () => {
    it("Destory 20%", async () => {
      const tx = await lbfStrategy.connect(owner).destroy(4000);
      await tx.wait(1);
    });
    xit("Destory 100%", async () => {
      const tx = await lbfStrategy.connect(owner).destroy(10000);
      await tx.wait(1);
    });
  });

  describe("Step 6 - Destroy all", async () => {
    it("Destory All", async () => {
      const tx = await lbfStrategy.connect(owner).destroyAll();
      await tx.wait(1);
    });
  });

  xdescribe("Step 7 - Return All Tokens To Storage", async () => {
    it("Return All Tokens To Storage", async () => {
      const tx = await lbfStrategy.connect(owner).returnAllTokensToStorage();
      await tx.wait(1);
    });
  });
};
