/*******************************************
 * Test on Rinkeby testnet, BSC testnet
 *******************************************/

import {ethers} from "hardhat";
import {erc20Abi} from "../../data/contracts_abi/erc20.json";
import {
  IERC20Upgradeable,
  StorageV3,
  CrossChainDepositor,
  CrossChainDepositor__factory,
  StorageV3__factory,
  AccumulatedDepositor,
  AccumulatedDepositor__factory,
} from "../../typechain-types";
import {expect} from "chai";
import {STARGATE_COLLECTION} from "../../data/addresses.json";
import {BigNumber} from "ethers";
import {logValue} from "../../utils/helpers";

const isTest = true;

// Privider for src, dst chain
const provider_src = new ethers.providers.JsonRpcProvider(
  isTest
    ? process.env.TESTNET_MUMBAI_PROVIDER_URL
    : process.env.MAINNET_POLYGON_PROVIDER_URL,
  isTest ? {name: "mumbai", chainId: 80001} : {name: "polygon", chainId: 137}
);
const provider_dst = new ethers.providers.JsonRpcProvider(
  isTest
    ? process.env.TESTNET_BSC_PROVIDER_URL
    : process.env.MAINNET_BSC_PROVIDER_URL,
  isTest ? {name: "binance", chainId: 97} : {name: "binance", chainId: 56}
);

// Your wallet
const owner_src = process.env.DEPLOYER_PRIVATE_KEY
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider_src)
  : ethers.Wallet.createRandom();
const other_src = process.env.DEPLOYER_PRIVATE_KEY_TEST
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY_TEST!, provider_src)
  : ethers.Wallet.createRandom();
const owner_dst = process.env.DEPLOYER_PRIVATE_KEY
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider_dst)
  : ethers.Wallet.createRandom();
const other_dst = process.env.DEPLOYER_PRIVATE_KEY_TEST
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY_TEST!, provider_dst)
  : ethers.Wallet.createRandom();

// Deployed contract address
const ethDepositorAddress = process.env.CROSSCHAIN_DEPOSITOR_ADDRESS!;
const bscDepositorAddress = process.env.ACCUMULATED_DEPOSITOR_ADDRESS!;
const storageAddress = process.env.STORAGE_PROXY_ADDRESS!;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Stargate information
const srcChainId = isTest
  ? STARGATE_COLLECTION.mumbai.chainId
  : STARGATE_COLLECTION.polygon.chainId;
const srcTokenAddress = isTest
  ? STARGATE_COLLECTION.mumbai.token.USDC.address
  : STARGATE_COLLECTION.polygon.token.USDC.address;
const srcTokenPoolId = isTest
  ? STARGATE_COLLECTION.mumbai.token.USDC.poolId
  : STARGATE_COLLECTION.polygon.token.USDC.poolId;
const dstChainId = isTest
  ? STARGATE_COLLECTION.bscTestnet.chainId
  : STARGATE_COLLECTION.bsc.chainId;
const dstTokenAddress = isTest
  ? STARGATE_COLLECTION.bscTestnet.token.USDT.address
  : STARGATE_COLLECTION.bsc.token.USDT.address;
const dstTokenPoolId = isTest
  ? STARGATE_COLLECTION.bscTestnet.token.USDT.poolId
  : STARGATE_COLLECTION.bsc.token.USDT.poolId;

// Test value
const amountDeposit = ethers.utils.parseEther("0.000000001");
const dstGasForCall: BigNumber = BigNumber.from("400000");
const reservedGas: BigNumber = BigNumber.from("380000");
const stargateExitGas: BigNumber = BigNumber.from("60000");
const depositAmount = "9994000000000000";

const abiCoder: any = new ethers.utils.AbiCoder();

export const crosschain_deposit = () => {
  let storage: StorageV3,
    srcDepositor: CrossChainDepositor,
    dstDepositor: AccumulatedDepositor,
    srcToken: IERC20Upgradeable,
    dstToken: IERC20Upgradeable;

  before(async () => {
    srcDepositor = CrossChainDepositor__factory.connect(
      ethDepositorAddress,
      owner_src
    );

    dstDepositor = AccumulatedDepositor__factory.connect(
      bscDepositorAddress,
      owner_dst
    );

    storage = StorageV3__factory.connect(storageAddress, owner_dst);

    srcToken = new ethers.Contract(
      srcTokenAddress,
      erc20Abi,
      owner_src
    ) as IERC20Upgradeable;

    dstToken = new ethers.Contract(
      dstTokenAddress,
      erc20Abi,
      owner_dst
    ) as IERC20Upgradeable;
  });

  describe("Chain 1 - CrossChainDepositor", async () => {
    describe("Set AccumulatedDepositor", async () => {
      it("only owner can set AccumulatedDepositor", async () => {
        await expect(
          srcDepositor
            .connect(other_src)
            .setAccumulatedDepositor(bscDepositorAddress)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Set AccumulatedDepositor", async () => {
        const tx = await srcDepositor
          .connect(owner_src)
          .setAccumulatedDepositor(bscDepositorAddress);
        await tx.wait(1);
      });
    });

    describe("Add Stargate Token", async () => {
      it("Only owner can add Stargate token", async () => {
        await expect(
          srcDepositor
            .connect(other_src)
            .addStargateToken(srcTokenAddress, srcTokenPoolId)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Token Address can't be empty", async () => {
        await expect(
          srcDepositor
            .connect(owner_src)
            .addStargateToken(ZERO_ADDRESS, srcTokenPoolId)
        ).to.be.revertedWith("CD2");
      });

      it("Add src token", async () => {
        await srcDepositor
          .connect(owner_src)
          .addStargateToken(srcTokenAddress, srcTokenPoolId);
      });

      it("Add dst token", async () => {
        await srcDepositor
          .connect(owner_src)
          .addStargateToken(dstTokenAddress, dstTokenPoolId);
      });

      it("Cannot add token twice", async () => {
        await expect(
          srcDepositor
            .connect(owner_src)
            .addStargateToken(srcTokenAddress, srcTokenPoolId)
        ).to.be.revertedWith("CD3");
      });
    });
  });

  describe("Chain 2 - AccumulatedDepositor", async () => {
    describe("Add Stargate Token to AccumulatedDepositor", async () => {
      it("Only owner can add Stargate token", async () => {
        await expect(
          dstDepositor.connect(other_dst).addStargateToken(dstTokenAddress)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Token Address can't be empty", async () => {
        await expect(
          dstDepositor.connect(owner_dst).addStargateToken(ZERO_ADDRESS)
        ).to.be.revertedWith("AD3");
      });

      it("Add token", async () => {
        await dstDepositor.connect(owner_dst).addStargateToken(dstTokenAddress);
      });

      it("Cannot add token twice", async () => {
        await expect(
          dstDepositor.connect(owner_dst).addStargateToken(dstTokenAddress)
        ).to.be.revertedWith("AD4");
      });

      it("Set stargateReserveGas", async () => {
        const tx = await dstDepositor.setStargateReserveGas(
          reservedGas.toString()
        );
        await tx.wait(1);
      });

      it("Set stargateExitGas", async () => {
        const tx = await dstDepositor.setStargateExitGas(stargateExitGas);
        await tx.wait(1);
      });
    });

    describe("Storage", async () => {
      it("Add token", async () => {
        const tx = await storage
          .connect(owner_dst)
          .addToken(dstTokenAddress, process.env.AGGREGATOR_ADDRESS!);
        await tx.wait(1);
      });
    });
  });

  describe("Deposit Remote", async () => {
    let depositFee: BigNumber;

    it("Get deposit fee", async () => {
      depositFee = await srcDepositor
        .connect(owner_src)
        .getDepositFeeStargate(dstChainId, dstGasForCall);
      logValue("Required Fee", depositFee);
    });

    it("Approve src Token", async () => {
      const tx = await srcToken
        .connect(owner_src)
        .approve(srcDepositor.address, amountDeposit);
      await tx.wait(1);
    });

    xit("src Token should be added", async () => {
      await expect(
        srcDepositor
          .connect(owner_src)
          .depositStarGate(
            dstChainId,
            other_src.address,
            dstToken.address,
            amountDeposit,
            0,
            dstGasForCall
          )
      ).to.be.revertedWith("CD1");
    });

    xit("dst Token should be added", async () => {
      await expect(
        srcDepositor
          .connect(owner_src)
          .depositStarGate(
            dstChainId,
            srcToken.address,
            other_src.address,
            amountDeposit,
            0,
            dstGasForCall
          )
      ).to.be.revertedWith("CD1");
    });

    xit("Some eth is required", async () => {
      await expect(
        srcDepositor
          .connect(owner_src)
          .depositStarGate(
            dstChainId,
            srcToken.address,
            dstToken.address,
            amountDeposit,
            0,
            dstGasForCall
          )
      ).to.be.revertedWith("CD5");
    });

    xit("deposit amount should be > 0", async () => {
      await expect(
        srcDepositor
          .connect(owner_src)
          .depositStarGate(
            dstChainId,
            srcToken.address,
            dstToken.address,
            "0",
            "0",
            dstGasForCall,
            {value: depositFee.div(2).toString()}
          )
      ).to.be.revertedWith("CD6");
    });

    xit("dstGasForCall should be initialized", async () => {
      await expect(
        srcDepositor
          .connect(owner_src)
          .depositStarGate(
            dstChainId,
            srcToken.address,
            dstToken.address,
            amountDeposit,
            0,
            dstGasForCall,
            {value: depositFee.div(2).toString()}
          )
      ).to.be.revertedWith("CD8");
    });

    it("Set dstGasForCall, but should send enough dstGasForCall", async () => {
      const tx = await srcDepositor.setStargateDstGasForCall(
        dstGasForCall.toString()
      );
      await tx.wait(1);

      await expect(
        srcDepositor
          .connect(owner_src)
          .depositStarGate(
            dstChainId,
            srcToken.address,
            dstToken.address,
            amountDeposit,
            0,
            dstGasForCall.div(2),
            {value: depositFee.div(2).toString()}
          )
      ).to.be.revertedWith("CD8");
    });

    xit("Should send enough eth gas fee", async () => {
      await expect(
        srcDepositor
          .connect(owner_src)
          .depositStarGate(
            dstChainId,
            srcToken.address,
            dstToken.address,
            amountDeposit,
            0,
            dstGasForCall,
            {value: depositFee.div(2).toString()}
          )
      ).to.be.revertedWith("CD7");
    });

    xit("Destination chain id should be exist", async () => {
      await expect(
        srcDepositor
          .connect(owner_src)
          .depositStarGate(
            "99",
            srcToken.address,
            dstToken.address,
            amountDeposit,
            0,
            dstGasForCall,
            {value: depositFee.toString()}
          )
      ).to.be.reverted;
    });

    xit("amountOutMin should be correct amount", async () => {
      await expect(
        srcDepositor
          .connect(owner_src)
          .depositStarGate(
            dstChainId,
            srcToken.address,
            dstToken.address,
            amountDeposit,
            ethers.utils.parseEther("10000"),
            dstGasForCall,
            {value: depositFee.toString()}
          )
      ).to.be.reverted;
    });

    it("Deposit successfully", async () => {
      const tx = await srcDepositor
        .connect(owner_src)
        .depositStarGate(
          dstChainId,
          srcToken.address,
          dstToken.address,
          amountDeposit,
          0,
          dstGasForCall,
          {value: depositFee.toString()}
        );

      await tx.wait(1);
    });
  });

  describe("Call sgReceive Directly", async () => {
    it("Send USDT to AccumulatedDepositor", async () => {
      const tx = await dstToken
        .connect(owner_dst)
        .transfer(dstDepositor.address, depositAmount);
      await tx.wait(1);
    });

    xit("Approve Storage for direct deposit", async () => {
      const tx = await dstToken
        .connect(owner_dst)
        .approve(storage.address, ethers.utils.parseEther("10000"));
      await tx.wait(1);
    });

    xit("Call storage.depositOnBehalf directly", async () => {
      console.log(
        await dstToken.allowance(dstDepositor.address, storage.address)
      );

      const tx = await storage
        .connect(owner_dst)
        .depositOnBehalf(100000, dstToken.address, owner_dst.address);
      await tx.wait(1);
    });

    it("Call sgReceive", async () => {
      // Get gas estimation
      console.log(
        await dstDepositor.estimateGas.sgReceive(
          dstChainId,
          abiCoder.encode(["address"], [ethDepositorAddress]),
          1000,
          dstToken.address,
          depositAmount,
          abiCoder.encode(["address"], [owner_dst.address]),
          {gasLimit: dstGasForCall.toString()}
        )
      );

      const tx = await dstDepositor.sgReceive(
        dstChainId,
        abiCoder.encode(["address"], [ethDepositorAddress]),
        1000,
        dstToken.address,
        depositAmount,
        abiCoder.encode(["address"], [owner_dst.address]),
        {gasLimit: dstGasForCall.div(1).toString()}
      );

      await tx.wait(1);
    });
  });
};
