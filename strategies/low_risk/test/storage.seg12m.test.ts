import { ethers, upgrades, network } from "hardhat";
import { loadFixture, mine, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  ERC20,
  StorageV21Patched,
  AggregatorN3,
} from "../typechain-types";
import { BigNumber, ContractFactory } from "ethers";


describe("Storage", async () => {
  async function deployFixture() {
    let tx,
      storage: StorageV21Patched,
      blid: ERC20,
      usdt: ERC20,
      usdc: ERC20,
      aggregator3: AggregatorN3;


    const [owner, expenseer, addr1, addr2, logic] = await ethers.getSigners();

    const storageFactory = await ethers.getContractFactory("StorageV21Patched", owner);
    storage = (await upgrades.deployProxy(storageFactory, [], {
      initializer: "initialize",
      unsafeAllow: ["constructor"],
    })) as StorageV21Patched;
    await storage.deployed();

    const blidFactory = await ethers.getContractFactory("ERC20", owner);
    blid = await blidFactory.deploy("BLID", "BLID");
    await blid.deployed();

    const usdtFactory = await ethers.getContractFactory("ERC20", owner);
    usdt = await usdtFactory.deploy("USDT", "USDT");
    await blid.deployed();

    const usdcFactory = await ethers.getContractFactory("ERC20", owner);
    usdc = await usdcFactory.deploy("USDC", "USDC");
    await usdc.deployed();

    const aggregator3Factory = await ethers.getContractFactory("AggregatorN3", owner);
    aggregator3 = await aggregator3Factory.deploy();
    await aggregator3.deployed();

    tx = await storage.connect(owner).setBLID(blid.address);
    await tx.wait();
    tx = await storage.connect(owner).setLogic(logic.address);
    await tx.wait();

    tx = await storage.connect(owner).addToken(usdt.address, aggregator3.address);
    await tx.wait();
    tx = await storage.connect(owner).addToken(usdc.address, aggregator3.address);
    await tx.wait();

    const amount = ethers.utils.parseEther("10000000");
    tx = await usdt.connect(owner).transfer(addr1.address, amount);
    await tx.wait();
    tx = await usdt.connect(owner).transfer(addr2.address, amount);
    await tx.wait();
    tx = await usdt.connect(addr1).approve(storage.address, amount);
    await tx.wait();
    tx = await usdt.connect(addr2).approve(storage.address, amount);
    await tx.wait();

    tx = await usdc.connect(owner).transfer(addr1.address, amount);
    await tx.wait();
    tx = await usdc.connect(owner).transfer(addr2.address, amount);
    await tx.wait();
    tx = await usdc.connect(addr1).approve(storage.address, amount);
    await tx.wait();
    tx = await usdc.connect(addr2).approve(storage.address, amount);
    await tx.wait();

    tx = await blid.connect(owner).transfer(expenseer.address, amount);
    await tx.wait();
    tx = await blid.connect(owner).transfer(addr1.address, amount);
    await tx.wait();
    tx = await blid.connect(owner).transfer(addr2.address, amount);
    await tx.wait();
    tx = await blid.connect(owner).transfer(logic.address, amount);
    await tx.wait();
    tx = await blid.connect(logic).approve(storage.address, amount);
    await tx.wait();
    tx = await blid.connect(expenseer).approve(storage.address, amount);
    await tx.wait();
    tx = await blid.connect(addr1).approve(storage.address, amount);
    await tx.wait();
    tx = await blid.connect(addr2).approve(storage.address, amount);
    await tx.wait();

    tx = await storage.connect(owner).setBoostingAddress(expenseer.address);
    await tx.wait();

    const maxBlidPerUSD = ethers.utils.parseEther("1");
    const blidPerBlock = ethers.utils.parseEther("0.000000028538812785");
    const maxActiveBLID = ethers.utils.parseEther("10000000");
    tx = await storage.connect(owner).setBoostingInfo(maxBlidPerUSD, blidPerBlock, maxActiveBLID);
    await tx.wait();

    return { storage, blid, usdt, usdc, owner, expenseer, addr1, addr2, logic };
  }

  async function forwardTo(amount: number = 1) {
    console.log('------------------------');
    console.log(`Move forward ${amount} blocks..`);
    await time.increase(31536000);
    await mine(amount);
    console.log('------------------------');
  }

  it("should be allow user to deposit and withdraw in one epoch and getting reward in next epoch", async () => {
    let tx;
    let userTokenTimeCalculated: BigNumber;
    const amount = "10";
    const depositAmount = ethers.utils.parseEther(amount);
    const { storage, usdt, addr1, logic } = await loadFixture(deployFixture);

    console.log(`User Deposit ${amount} USDT...`);
    tx = await storage.connect(addr1).deposit(depositAmount, usdt.address);
    await tx.wait();
    userTokenTimeCalculated = depositAmount.mul(await time.latest());
    console.log('--User Token Time calculated:', userTokenTimeCalculated.toString());
    console.log('--User Token Time from the contract:', (await storage.getUserTokenTime(addr1.address, usdt.address)).toString());

    await forwardTo(100);

    console.log(`User Withdraw ${amount} USDT...`);
    tx = await storage.connect(addr1).withdraw(depositAmount, usdt.address);
    await tx.wait();
    userTokenTimeCalculated = userTokenTimeCalculated.sub(
      depositAmount.mul(await time.latest())
    );
    console.log('--User Token Time calculated:', userTokenTimeCalculated.toString());
    console.log('--User Token Time from the contract:', (await storage.getUserTokenTime(addr1.address, usdt.address)).toString());

    await forwardTo(100);

    console.log('NEW EPOCH - Add Earn');
    const addEarnAmount = ethers.utils.parseEther("50");
    await storage.connect(logic).addEarn(addEarnAmount);
    console.log('------------------------');

    const [epochTDT, epochRate, epochTimestamp] = await storage.getEpochInfo(0, usdt.address);
    console.log('--Epoch #0 TDT:', epochTDT.toString());

    const userTDT = await storage.getUserTDT(addr1.address, usdt.address);
    console.log('--User TDT:', userTDT.toString());

    const userTokenTimeCalculatedLast = (
      await storage.getTokenDeposit(addr1.address, usdt.address)
    )
      .mul(await time.latest())
      .sub(userTokenTimeCalculated);

    const userTokenTime = await storage.getUserTokenTime(addr1.address, usdt.address);
    console.log('--User Token Time:', userTokenTime.toString());

    const calculatedUserEarnExpected = addEarnAmount
      .mul(userTokenTimeCalculatedLast)
      .div(userTokenTimeCalculatedLast);
    console.log('--Expected Earn:', ethers.utils.formatEther(calculatedUserEarnExpected));

    const actualEarned = await storage.balanceEarnBLID(addr1.address);
    console.log('--Actual Earn:', ethers.utils.formatEther(actualEarned));


    expect(await storage.balanceOf(addr1.address)).to.be.equal(0);
    expect(actualEarned).to.be.equal(addEarnAmount);
    expect(actualEarned).to.be.equal(calculatedUserEarnExpected);
    expect(userTokenTime).to.be.equal(userTokenTimeCalculated);
  });

  it("should be allow two users to deposit and withdraw in one epoch and getting reward in next epoch", async () => {
    let tx;
    let user1TokenTimeCalculated: BigNumber;
    let user2TokenTimeCalculated: BigNumber;
    const amount = "10";
    const lessAmount = "10";
    const depositAmount = ethers.utils.parseEther(amount);
    const withdrawAmount = ethers.utils.parseEther(lessAmount);
    const { storage, usdt, addr1, addr2, logic } = await loadFixture(deployFixture);

    console.log(`User1 Deposit ${amount} USDT...`);
    tx = await storage.connect(addr1).deposit(depositAmount, usdt.address);
    await tx.wait();
    user1TokenTimeCalculated = depositAmount.mul(await time.latest());
    console.log('--User Token Time calculated:', user1TokenTimeCalculated.toString());
    console.log('--User Token Time from the contract:', (await storage.getUserTokenTime(addr1.address, usdt.address)).toString());

    await forwardTo(100);

    console.log(`User2 Deposit ${amount} USDT...`);
    tx = await storage.connect(addr2).deposit(depositAmount, usdt.address);
    await tx.wait();
    user2TokenTimeCalculated = depositAmount.mul(await time.latest());
    console.log('--User Token Time calculated:', user2TokenTimeCalculated.toString());
    console.log('--User Token Time from the contract:', (await storage.getUserTokenTime(addr2.address, usdt.address)).toString());
    await forwardTo(100);

    console.log(`User2 Withdraw ${lessAmount} USDT...`);
    tx = await storage.connect(addr2).withdraw(withdrawAmount, usdt.address);
    await tx.wait();
    user2TokenTimeCalculated = user2TokenTimeCalculated.sub(
      withdrawAmount.mul(await time.latest())
    );
    console.log('--User2 Token Time calculated:', user2TokenTimeCalculated.toString());
    console.log('--User2 Token Time from the contract:', (await storage.getUserTokenTime(addr2.address, usdt.address)).toString());

    await forwardTo(100);

    console.log(`User2 Deposit ${amount} USDT...`);
    tx = await storage.connect(addr2).deposit(depositAmount, usdt.address);
    await tx.wait();
    user2TokenTimeCalculated = user2TokenTimeCalculated.add(
      depositAmount.mul(await time.latest())
    );
    console.log('--User2 Token Time calculated:', user2TokenTimeCalculated.toString());
    console.log('--User2 Token Time from the contract:', (await storage.getUserTokenTime(addr2.address, usdt.address)).toString());

    await forwardTo(100);

    console.log(`User2 Withdraw ${lessAmount} USDT...`);
    tx = await storage.connect(addr2).withdraw(withdrawAmount, usdt.address);
    await tx.wait();
    user2TokenTimeCalculated = user2TokenTimeCalculated.sub(
      withdrawAmount.mul(await time.latest())
    );
    console.log('--User2 Token Time calculated:', user2TokenTimeCalculated.toString());
    console.log('--User2 Token Time from the contract:', (await storage.getUserTokenTime(addr2.address, usdt.address)).toString());

    await forwardTo(100);

    console.log(`User2 Deposit ${amount} USDT...`);
    tx = await storage.connect(addr2).deposit(depositAmount, usdt.address);
    await tx.wait();
    user2TokenTimeCalculated = user2TokenTimeCalculated.add(
      depositAmount.mul(await time.latest())
    );
    console.log('--User2 Token Time calculated:', user2TokenTimeCalculated.toString());
    console.log('--User2 Token Time from the contract:', (await storage.getUserTokenTime(addr2.address, usdt.address)).toString());

    await forwardTo(100);

    console.log(`User2 Withdraw ${lessAmount} USDT...`);
    tx = await storage.connect(addr2).withdraw(withdrawAmount, usdt.address);
    await tx.wait();
    user2TokenTimeCalculated = user2TokenTimeCalculated.sub(
      withdrawAmount.mul(await time.latest())
    );
    console.log('--User2 Token Time calculated:', user2TokenTimeCalculated.toString());
    console.log('--User2 Token Time from the contract:', (await storage.getUserTokenTime(addr2.address, usdt.address)).toString());

    await forwardTo(100);

    const earned = "50";
    const addEarnAmount = ethers.utils.parseEther(earned);
    console.log(`NEW EPOCH - Add Earn of ${earned} BLID`);
    await storage.connect(logic).addEarn(addEarnAmount);
    console.log('------------------------');

    const [epochTDT, epochRate, epochTimestamp, epochUsd] = await storage.getEpochInfo(0, usdt.address);
    console.log('--Epoch #0 TDT:', epochTDT.toString());
    console.log('--Epoch #0 Rate:', epochRate.toString());
    console.log('--Epoch #0 Timestamp:', epochTimestamp.toString());
    console.log('--Epoch #0 USD:', epochUsd.toString());
    const tokenTime = await storage.getTokenTime(usdt.address);
    const dollarTime = tokenTime.mul(epochRate);
    console.log('--Dollar Time:', dollarTime.toString());
    console.log('--Token Time:', tokenTime.toString());

    const user1TDT = await storage.getUserTDT(addr1.address, usdt.address);
    console.log('--User1 TDT:', user1TDT.toString());
    const user2TDT = await storage.getUserTDT(addr2.address, usdt.address);
    console.log('--User2 TDT:', user2TDT.toString());
    console.log('--Total User TDT', user1TDT.add(user2TDT).toString());

    const user1TokenTimeCalculatedLast = (
      await storage.getTokenDeposit(addr1.address, usdt.address)
    )
      .mul(await time.latest())
      .sub(user1TokenTimeCalculated);

    const user2TokenTimeCalculatedLast = (
      await storage.getTokenDeposit(addr2.address, usdt.address)
    )
      .mul(await time.latest())
      .sub(user2TokenTimeCalculated);

    const user1TokenTime = await storage.getUserTokenTime(addr1.address, usdt.address);
    console.log('--User1 Token Time:', user1TokenTime.toString());
    const user2TokenTime = await storage.getUserTokenTime(addr2.address, usdt.address);
    console.log('--User2 Token Time:', user2TokenTime.toString());

    const calculatedUser1EarnExpected = addEarnAmount
      .mul(user1TokenTimeCalculatedLast)
      .div(user1TokenTimeCalculatedLast.add(user2TokenTimeCalculatedLast));
    console.log('--User1 Expected Earn:', ethers.utils.formatEther(calculatedUser1EarnExpected));
    const calculatedUser2EarnExpected = addEarnAmount
      .mul(user2TokenTimeCalculatedLast)
      .div(user1TokenTimeCalculatedLast.add(user2TokenTimeCalculatedLast));
    console.log('--User2 Expected Earn:', ethers.utils.formatEther(calculatedUser2EarnExpected));

    const actualEarnedUser1 = await storage.balanceEarnBLID(addr1.address);
    console.log('--User1 Actual Earn:', ethers.utils.formatEther(actualEarnedUser1));
    const actualEarnedUser2 = await storage.balanceEarnBLID(addr2.address);
    console.log('--User2 Actual Earn:', ethers.utils.formatEther(actualEarnedUser2));


    expect(user1TDT.add(user2TDT)).to.be.equal(epochTDT);
    expect(actualEarnedUser1).to.be.equal(calculatedUser1EarnExpected);
    expect(actualEarnedUser2).to.be.equal(calculatedUser2EarnExpected);
    expect(user1TokenTime).to.be.equal(user1TokenTimeCalculated);
    expect(user2TokenTime).to.be.equal(user2TokenTimeCalculated);
    expect(actualEarnedUser1.add(actualEarnedUser2)).to.be.closeTo(addEarnAmount, ethers.utils.parseEther("0.000000000000000001"));
  });

  it("should be allow user to deposit and in the next epoch withdraw in one year", async () => {
    let tx;
    let user1TokenTimeCalculated: BigNumber;
    const amount = "10";
    const depositAmount = ethers.utils.parseEther(amount);
    const { storage, usdt, addr1, addr2, logic, blid } = await loadFixture(deployFixture);

    console.log(`User 1 Deposit ${amount} USDT...`);
    tx = await storage.connect(addr1).deposit(depositAmount, usdt.address);
    await tx.wait();
    user1TokenTimeCalculated = depositAmount.mul(await time.latest());
    console.log('--User Token Time calculated:', user1TokenTimeCalculated.toString());
    console.log('--User Token Time from the contract:', (await storage.getUserTokenTime(addr1.address, usdt.address)).toString());

    await forwardTo(300);

    console.log('NEW EPOCH - Add Earn');
    const addEarnAmount = ethers.utils.parseEther("50");
    await storage.connect(logic).addEarn(addEarnAmount);
    console.log('------------------------');

    // Forward to one year
    await time.increase(31536000);
    await forwardTo(10000000);

    const actualEarned = await storage.balanceEarnBLID(addr1.address);
    console.log('--Actual Earn:', ethers.utils.formatEther(actualEarned));


    const userBlidBalance = await blid.balanceOf(addr1.address);
    console.log(`User 1 Withdraw ${amount} USDT...`);
    await expect(storage.connect(addr1).withdraw(depositAmount.add(BigNumber.from(1)), usdt.address)).to.be.reverted;
    tx = await storage.connect(addr1).withdraw(depositAmount, usdt.address);
    await tx.wait();

    const updatedUserBlidBalance = await blid.balanceOf(addr1.address);

    expect(actualEarned).to.be.equal(addEarnAmount);
    expect(userBlidBalance.add(actualEarned)).to.be.equal(updatedUserBlidBalance);

  });

  it("should be allow user to deposit and in one year withdraw in the same epoch", async () => {
    let tx;
    let user1TokenTimeCalculated: BigNumber;
    const amount = "10";
    const depositAmount = ethers.utils.parseEther(amount);
    const { storage, usdt, addr1, addr2, logic, blid } = await loadFixture(deployFixture);

    console.log(`User 1 Deposit ${amount} USDT...`);
    tx = await storage.connect(addr1).deposit(depositAmount, usdt.address);
    await tx.wait();
    user1TokenTimeCalculated = depositAmount.mul(await time.latest());
    console.log('--User Token Time calculated:', user1TokenTimeCalculated.toString());
    console.log('--User Token Time from the contract:', (await storage.getUserTokenTime(addr1.address, usdt.address)).toString());

    await forwardTo(30000);

    // Forward to one year
    await time.increase(31536000);
    await forwardTo(10000000);

    const userBlidBalance = await blid.balanceOf(addr1.address);
    console.log(`User 1 Withdraw ${amount} USDT...`);
    await expect(storage.connect(addr1).withdraw(depositAmount.add(BigNumber.from(1)), usdt.address)).to.be.reverted;
    tx = await storage.connect(addr1).withdraw(depositAmount, usdt.address);
    await tx.wait();


    console.log('NEW EPOCH - Add Earn');
    const addEarnAmount = ethers.utils.parseEther("50");
    await storage.connect(logic).addEarn(addEarnAmount);
    console.log('------------------------');


    const actualEarned = await storage.balanceEarnBLID(addr1.address);
    console.log('--Actual Earn:', ethers.utils.formatEther(actualEarned));
    await storage.connect(addr1).claimAllRewardBLID();

    const updatedUserBlidBalance = await blid.balanceOf(addr1.address);

    expect(actualEarned).to.be.equal(addEarnAmount);
    expect(userBlidBalance.add(actualEarned)).to.be.equal(updatedUserBlidBalance);
  });
});