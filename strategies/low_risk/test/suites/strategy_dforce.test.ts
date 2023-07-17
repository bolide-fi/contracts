/*******************************************
 * Test on Polygon Mainnet
 * Before run test, deploy storage, logic, aggregator contract on mainnet
 *******************************************/

import dotenv from "dotenv";
import {ethers} from "hardhat";
import {expect, assert} from "chai";
import {cErcAbi} from "../../data/contracts_abi/compound.json";
import {erc20Abi} from "../../data/contracts_abi/erc20.json";
import {
  StorageV3,
  StorageV3__factory,
  DForceLogic,
  DForceLogic__factory,
  DForceStrategy,
  SwapGateway,
  SwapGateway__factory,
  DForceStrategy__factory,
  MultiLogic,
  MultiLogic__factory,
} from "../../typechain-types";
import {ADDRESS_COLLECTION, PLATFORM} from "../../data/addresses.json";
import {sleep, logValue} from "../../utils/helpers";
import {BigNumber} from "ethers";

dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(
  process.env.MAINNET_POLYGON_PROVIDER_URL,
  {name: "polygon", chainId: 137}
);

// Load Addresses
const ADDRESSES = ADDRESS_COLLECTION.polygon;
const platform = PLATFORM["polygon-delta"];
const blidAddress = platform.blid;

// Your Ethereum wallet private key
const owner = process.env.DEPLOYER_PRIVATE_KEY
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider)
  : ethers.Wallet.createRandom();
const other = process.env.DEPLOYER_PRIVATE_KEY_TEST
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY_TEST!, provider)
  : ethers.Wallet.createRandom();

// Mainnet deployed Contract address
const dfLogicAddress = process.env.DFORCE_LOGIC_PROXY_ADDRESS!;
const dfStrategyAddress = process.env.DFORCE_STRATEGY_PROXY_ADDRESS!;
const multiLogicProxyAddress = process.env.MULTILOGIC_PROXY_ADDRESS!;
const swapGatewayAddress = process.env.SWAP_GATEWAY_PROXY_ADDRESS!;
const storageAddress = process.env.STORAGE_PROXY_ADDRESS!;

// Initialize Contract
const USDT = new ethers.Contract(
  ADDRESSES.Token.USDT.Underlying,
  erc20Abi,
  owner
);
const DAI = new ethers.Contract(
  ADDRESSES.Token.DAI.Underlying,
  erc20Abi,
  owner
);
const iUSDT = new ethers.Contract(ADDRESSES.Token.USDT.dForce, cErcAbi, owner);
const iUSDC = new ethers.Contract(ADDRESSES.Token.USDC.dForce, cErcAbi, owner);
const iDAI = new ethers.Contract(ADDRESSES.Token.DAI.dForce, cErcAbi, owner);
const DF = new ethers.Contract(ADDRESSES.Token.DF.Underlying, erc20Abi, owner);
const BLID = new ethers.Contract(blidAddress, erc20Abi, owner);

// Variables for deployed contract
let storage: StorageV3,
  dfStrategy: DForceStrategy,
  logic: DForceLogic,
  swapGateway: SwapGateway,
  multiLogicProxy: MultiLogic;

// Testing Value
const amountDepositToStorage: BigNumber = BigNumber.from("10000"); // USDT
const amountTakeFromStorage: BigNumber = BigNumber.from("7000"); // USDT
const amountWithdrawFromStorage: BigNumber = BigNumber.from("1000"); // USDT
const minimumBLIDPerRewardToken: BigNumber = BigNumber.from("10");
const gasPrice = process.env.GAS_PRICE_POLYGON;

require("chai").use(require("chai-as-promised")).should();

export const strategy_dforce = () => {
  before(async () => {
    logic = DForceLogic__factory.connect(dfLogicAddress, owner);
    swapGateway = SwapGateway__factory.connect(swapGatewayAddress, owner);
    dfStrategy = DForceStrategy__factory.connect(dfStrategyAddress, owner);
    multiLogicProxy = MultiLogic__factory.connect(
      multiLogicProxyAddress,
      owner
    );
    storage = StorageV3__factory.connect(storageAddress, owner);
  });

  xdescribe("Preparation", async () => {
    xit("rebalance Parameter", async () => {
      const tx = await dfStrategy
        .connect(owner)
        .setRebalanceParameter("600000000000000000", "800000000000000000", {
          gasPrice: gasPrice,
        });
      await tx.wait(1);
    });

    xit("MultiLogic", async () => {
      let tx = await multiLogicProxy.connect(owner).initStrategies(
        ["DF"],
        [
          {
            logicContract: logic.address,
            strategyContract: dfStrategy.address,
          },
        ],
        {
          gasPrice: gasPrice,
        }
      );
      await tx.wait(1);

      tx = await multiLogicProxy
        .connect(owner)
        .setPercentages(USDT.address, ["10000"], {
          gasPrice: gasPrice,
        });
      await tx.wait(1);
    });

    xit("Storage withdraw", async () => {
      const tx = await storage
        .connect(owner)
        .withdraw(3000, USDT.address, {gasPrice: gasPrice});
    });

    xit("Storage approve", async () => {
      const tx = await USDT.connect(owner).approve(storage.address, 100000000, {
        gasPrice: gasPrice,
      });
    });

    xit("Storage deposit", async () => {
      const tx = await storage
        .connect(owner)
        .deposit(10000, USDT.address, {gasPrice: gasPrice});
    });
  });

  xdescribe("Strategy", async () => {
    xit("Claim Rewards", async () => {
      const tx = await dfStrategy.connect(owner).claimRewards({
        gasPrice: gasPrice,
      });

      await tx.wait(1);
    });

    xit("DestroyAll", async () => {
      const tx = await dfStrategy.connect(owner).destroyAll({
        gasPrice: gasPrice,
      });

      await tx.wait(1);
    });

    it("Settings", async () => {
      let tx = await dfStrategy.connect(owner).setMinStorageAvailable(1000000, {
        gasPrice: gasPrice,
      });

      await tx.wait(1);

      tx = await dfStrategy.connect(owner).setAvoidLiquidationFactor(5, {
        gasPrice: gasPrice,
      });
      await tx.wait(1);
    });

    it("SetRebalanceParameter 80 - 85", async () => {
      const tx = await dfStrategy
        .connect(owner)
        .setRebalanceParameter("800000000000000000", "850000000000000000", {
          gasPrice: gasPrice,
        });

      await tx.wait(1);
    });

    it("setRewardsTokenPriceDeviationLimit 30% / day", async () => {
      let percent: BigNumber;
      percent = BigNumber.from(ethers.utils.parseEther("1"));
      percent = percent.mul(30).div(86400);

      const tx = await dfStrategy
        .connect(owner)
        .setRewardsTokenPriceDeviationLimit(percent.toString(), {
          gasPrice: gasPrice,
        });

      await tx.wait(1);
    });
  });
};
