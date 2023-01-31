/*******************************************
 * Test on hardhat
 *******************************************/

import { ethers, upgrades } from 'hardhat';
import { TokenDistributionModel } from './utils/TokenDistributionModel';
import { time } from '@openzeppelin/test-helpers';
import { ERC20, StorageV21, Aggregator, AggregatorN3 } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { start } from 'repl';

async function deployContracts(owner: SignerWithAddress) {
  let blid: ERC20,
    usdt: ERC20,
    usdtn2: ERC20,
    usdc: ERC20,
    storageV21: StorageV21,
    aggregator: Aggregator,
    aggregator3: AggregatorN3,
    model: TokenDistributionModel;

  model = new TokenDistributionModel();
  const logicContract = '0xee62f8548e7e97a6ae76d7cc42421ada906b129a';
  const StorageV21 = await ethers.getContractFactory('StorageV21', owner);
  const Aggregator = await ethers.getContractFactory('Aggregator', owner);
  const AggregatorN3 = await ethers.getContractFactory('AggregatorN3', owner);
  const USDT = await ethers.getContractFactory('ERC20', owner);
  const USDC = await ethers.getContractFactory('ERC20', owner);
  const BLID = await ethers.getContractFactory('ERC20', owner);
  const USDTN2 = await ethers.getContractFactory('ERC20', owner);

  aggregator = (await Aggregator.deploy()) as Aggregator;
  aggregator3 = (await AggregatorN3.deploy()) as AggregatorN3;
  blid = (await BLID.deploy('some erc20 as if BLID', 'SERC')) as ERC20;
  usdt = (await USDT.deploy('some erc20', 'SERC')) as ERC20;
  usdtn2 = (await USDTN2.deploy('some erc20', 'SERC')) as ERC20;
  usdc = (await USDC.deploy('some erc20', 'SERC')) as ERC20;

  storageV21 = (await upgrades.deployProxy(StorageV21, [logicContract], {
    initializer: 'initialize',
  })) as StorageV21;
  await storageV21.deployed();

  let tx;
  tx = await storageV21.connect(owner).setBLID(blid.address);
  await tx.wait(1);
  await storageV21.connect(owner).addToken(usdt.address, aggregator3.address);
  await tx.wait(1);

  return {
    blid,
    usdt,
    usdtn2,
    usdc,
    storageV21,
    aggregator,
    aggregator3,
    model,
  };
}

const MaxBlidPerUSD: BigNumber = ethers.utils.parseEther('3');
const OverDepositPerUSD: BigNumber = ethers.utils.parseEther('1');
const BlidPerBlock: BigNumber = ethers.utils.parseEther('10'); // BLID
const MaxBlidPerBlock: BigNumber = ethers.utils.parseEther('200'); // BLID

const secondBlidPerBlock: BigNumber = ethers.utils.parseEther('7'); // BLID
const secondMaxBlidPerUSD: BigNumber = ethers.utils.parseEther('2'); // BLID
const firstUSDRate: BigNumber = BigNumber.from('100000000');
const secondUSDRate: BigNumber = BigNumber.from('80000000');

const amountUSDTDeposit: BigNumber = ethers.utils.parseEther('6'); // USDT

let startBlockUser1: number, startBlockUser2: number, currentBlock: number;
let user1DepositAmount: BigNumber;
let user2DepositAmount: BigNumber;

describe('Boosting2.0', async () => {
  let blid: ERC20, usdt: ERC20, usdtn2: ERC20, usdc: ERC20;
  let storageV21: StorageV21,
    aggregator: Aggregator,
    aggregator3: AggregatorN3,
    model: TokenDistributionModel;
  let owner: SignerWithAddress,
    logicContract: SignerWithAddress,
    other1: SignerWithAddress,
    other2: SignerWithAddress,
    expenseer: SignerWithAddress;

  before(async () => {
    [owner, logicContract, other1, other2, expenseer] = await ethers.getSigners();
    const contracts = await deployContracts(owner);

    blid = contracts.blid;
    usdt = contracts.usdt;
    usdtn2 = contracts.usdtn2;
    storageV21 = contracts.storageV21;
    aggregator = contracts.aggregator;
    aggregator3 = contracts.aggregator3;
    model = contracts.model;
  });
  before(async () => {
    await usdt.connect(owner).transfer(other1.address, ethers.utils.parseEther('100000'));

    await usdt.connect(owner).transfer(other2.address, ethers.utils.parseEther('100000'));

    await blid.connect(owner).transfer(expenseer.address, ethers.utils.parseEther('999999'));

    await blid.connect(owner).transfer(other1.address, ethers.utils.parseEther('999999'));

    await blid.connect(owner).transfer(other2.address, ethers.utils.parseEther('999999'));

    await storageV21.connect(owner).setBoostingAddress(expenseer.address);
  });

  describe('StorageV21', async () => {
    const calcDepositBLIDAmount = async (
      address: string,
      maxBlidPerUSD: BigNumber,
    ): Promise<BigNumber> => {
      const userDepositAmount = (await storageV21.balanceOf(address))
        .mul(maxBlidPerUSD)
        .div(ethers.utils.parseEther('1'));

      const userBLIDBalance = await storageV21.getBoostingBLIDAmount(address);

      return userDepositAmount.gt(userBLIDBalance) ? userBLIDBalance : userDepositAmount;
    };

    describe('setBoostingInfo', async () => {
      it('only owner can set boosting info', async () => {
        const tx = await expect(
          storageV21.connect(other1).setBoostingInfo(MaxBlidPerUSD, BlidPerBlock),
        ).to.be.rejectedWith('Ownable: caller is not the owner');
      });
      it('set boosting info', async () => {
        const tx = await storageV21.connect(owner).setBoostingInfo(MaxBlidPerUSD, BlidPerBlock);

        const maxBlidPerUSD = await storageV21.connect(owner).maxBlidPerUSD();
        const blidPerBlock = await storageV21.connect(owner).blidPerBlock();

        expect(maxBlidPerUSD).to.be.equal(MaxBlidPerUSD, 'maxBlidPerUSD should be same');
        expect(blidPerBlock).to.be.equal(BlidPerBlock, 'blidPerBlock should be same');
      });
    });

    describe('depositBLID', async () => {
      before(async () => {
        const tx = await usdt
          .connect(other1)
          .approve(storageV21.address, ethers.utils.parseEther('10000000000'));
        const tx1 = await blid
          .connect(other1)
          .approve(storageV21.address, ethers.utils.parseEther('10000000000'));
      });
      it('user must deposit stablecoin before deposit BLID', async () => {
        const tx = await expect(
          storageV21.connect(other1).depositBLID(amountUSDTDeposit),
        ).to.be.rejectedWith('E11');
      });

      it('user deposit USDT', async () => {
        const beforeBalance = await usdt.balanceOf(other1.address);

        const tx = await storageV21.connect(other1).deposit(amountUSDTDeposit, usdt.address);

        const afterBalance = await usdt.balanceOf(other1.address);
        expect(beforeBalance.toBigInt()).to.be.equal(
          afterBalance.add(amountUSDTDeposit).toBigInt(),
          'Deposit USDT',
        );
      });

      it('user deposit BLID for boosting', async () => {
        const beforeBlidbalance = await blid.balanceOf(other1.address);
        const depositAmount = amountUSDTDeposit
          .mul(MaxBlidPerUSD.add(OverDepositPerUSD))
          .div(ethers.utils.parseEther('1'));

        await storageV21.connect(other1).depositBLID(depositAmount);

        user1DepositAmount = (await storageV21.balanceOf(other1.address))
          .mul(MaxBlidPerUSD)
          .div(ethers.utils.parseEther('1'));

        const afterBlidbalance = await blid.balanceOf(other1.address);
        expect(beforeBlidbalance).to.be.equal(afterBlidbalance.add(depositAmount), 'Deposit BLID');
      });

      after(async () => {
        startBlockUser1 = await ethers.provider.getBlockNumber();
      });
    });

    describe('get Claimable Amount', async () => {
      before(async () => {
        await time.advanceBlock();
      });
      it('get boosting claimable BLID after one block', async () => {
        const claimableAmount = await storageV21.getBoostingClaimableBLID(other1.address);
        const blockCount = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        expect(claimableAmount).to.be.equal(
          user1DepositAmount.mul(BlidPerBlock).mul(blockCount).div(ethers.utils.parseEther('1')),
          'Claimable amount for user 1 should be the same',
        );
      });
    });

    describe('second deposit', async () => {
      before(async () => {
        const tx2 = await usdt
          .connect(other2)
          .approve(storageV21.address, ethers.utils.parseEther('10000000000'));
        const tx3 = await blid
          .connect(other2)
          .approve(storageV21.address, ethers.utils.parseEther('10000000000'));
      });
      it('second user deposit USDT', async () => {
        const beforeBalance = await usdt.balanceOf(other2.address);

        const tx = await storageV21.connect(other2).deposit(amountUSDTDeposit, usdt.address);

        const afterBalance = await usdt.balanceOf(other2.address);
        expect(beforeBalance.toBigInt()).to.be.equal(
          afterBalance.add(amountUSDTDeposit).toBigInt(),
          'Deposit USDT',
        );
      });
      it('second user deposit BLID', async () => {
        user2DepositAmount = (await storageV21.balanceOf(other2.address))
          .mul(MaxBlidPerUSD)
          .div(3)
          .div(ethers.utils.parseEther('1'));

        const tx = await storageV21.connect(other2).depositBLID(user2DepositAmount);
      });

      after(async () => {
        startBlockUser2 = await ethers.provider.getBlockNumber();
      });
    });

    describe('getClaimableBLID after second deposit', async () => {
      before(async () => {
        await time.advanceBlock();
      });
      it('get claimable BLID for user1, user2 after 1 blocks', async () => {
        const claimableAmount1 = await storageV21.getBoostingClaimableBLID(other1.address);
        const claimableAmount2 = await storageV21.getBoostingClaimableBLID(other2.address);
        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;

        const blockCountUser2 = (await ethers.provider.getBlockNumber()) - startBlockUser2 + 1;

        const beforeExpectUser1Amount = user1DepositAmount
          .mul(BlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const beforeExpectUser2Amount = user2DepositAmount
          .mul(BlidPerBlock)
          .mul(blockCountUser2)
          .div(ethers.utils.parseEther('1'));

        expect(claimableAmount1).to.be.equal(
          beforeExpectUser1Amount,
          'ClaimableBLId amout for User1',
        );
        expect(claimableAmount2).to.be.equal(
          beforeExpectUser2Amount,
          'ClaimableBLID amount for User2',
        );
      });
    });

    describe('update blidperblock', async () => {
      it('update boosting info', async () => {
        const tx = await storageV21
          .connect(owner)
          .setBoostingInfo(MaxBlidPerUSD, secondBlidPerBlock);

        const blidperBlock = await storageV21.blidPerBlock();
        expect(blidperBlock).to.be.equal(secondBlidPerBlock, 'BlidPerBlock does not udpated');
      });

      it('ClamableBLID sould be calculated with old blidPerBlock and new blidPerblock', async () => {
        await time.advanceBlock();
        await time.advanceBlock();
        await time.advanceBlock();

        currentBlock = await ethers.provider.getBlockNumber();

        const claimableAmount1 = await storageV21.getBoostingClaimableBLID(other1.address);
        const claimableAmount2 = await storageV21.getBoostingClaimableBLID(other2.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const blockCountUser2 = (await ethers.provider.getBlockNumber()) - startBlockUser2 + 1;

        const beforeExpectUser1Amount = user1DepositAmount
          .mul(BlidPerBlock)
          .mul(blockCountUser1 - 4)
          .div(ethers.utils.parseEther('1'))
          .add(user1DepositAmount.mul(secondBlidPerBlock).mul(4).div(ethers.utils.parseEther('1')));
        const beforeExpectUser2Amount = user2DepositAmount
          .mul(BlidPerBlock)
          .mul(blockCountUser2 - 4)
          .div(ethers.utils.parseEther('1'))
          .add(user2DepositAmount.mul(secondBlidPerBlock).mul(4).div(ethers.utils.parseEther('1')));

        expect(claimableAmount1).to.be.equal(
          beforeExpectUser1Amount,
          'ClaimableBLID amout for user1',
        );
        expect(claimableAmount2).to.be.equal(
          beforeExpectUser2Amount,
          'ClaimableBLID amount for user2',
        );
      });
    });

    describe('claim reward BLID', async () => {
      before(async () => {
        await blid
          .connect(expenseer)
          .approve(storageV21.address, ethers.utils.parseEther('100000'));

        await time.advanceBlock();
        currentBlock = await ethers.provider.getBlockNumber();
      });

      it('claim BLID for user1', async () => {
        const beforeBlidbalance = await blid.balanceOf(other1.address);
        const claimableBlid = await storageV21.getBoostingClaimableBLID(other1.address);

        const tx = await storageV21.connect(other1).claimBoostingRewardBLID();

        const afterBlidbalance = await blid.balanceOf(other1.address);
        expect(afterBlidbalance).to.be.above(
          beforeBlidbalance,
          'BLID balance of other should be increased',
        );

        expect(claimableBlid).to.be.equal(
          afterBlidbalance.sub(beforeBlidbalance),
          'ClaimableBLID should be the same as claim amount',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });

      it('claim BLID for user2', async () => {
        await time.advanceBlock();
        const beforeBlidbalance = await blid.balanceOf(other2.address);
        const claimableBlid = await storageV21.getBoostingClaimableBLID(other2.address);

        const tx = await storageV21.connect(other2).claimBoostingRewardBLID();

        const afterBlidbalance = await blid.balanceOf(other2.address);
        expect(afterBlidbalance).to.be.above(
          beforeBlidbalance,
          'BLID balance of other should be increased',
        );

        expect(claimableBlid).to.be.equal(
          afterBlidbalance.sub(beforeBlidbalance),
          'ClaimableBLID should be the same as claim amount',
        );

        startBlockUser2 = await ethers.provider.getBlockNumber();
      });
    });

    describe('Change MaxBLIDPerUSD', async () => {
      before(async () => {
        await time.advanceBlock();
      });

      it('update boosting info', async () => {
        const tx = await storageV21
          .connect(owner)
          .setBoostingInfo(secondMaxBlidPerUSD, secondBlidPerBlock);
        await tx.wait(1);

        const _maxBlidPerUSD = await storageV21.maxBlidPerUSD();
        expect(_maxBlidPerUSD).to.be.equal(secondMaxBlidPerUSD, 'MaxBlidPerUSD does not udpated');
      });

      it('ClamableBLID sould be calculated with old MaxBlidPerUSD, new BlidPerBlock', async () => {
        await time.advanceBlock();

        const claimableAmount1 = await storageV21.getBoostingClaimableBLID(other1.address);
        const claimableAmount2 = await storageV21.getBoostingClaimableBLID(other2.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const blockCountUser2 = (await ethers.provider.getBlockNumber()) - startBlockUser2 + 1;

        const beforeExpectUser1Amount = user1DepositAmount
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const beforeExpectUser2Amount = user2DepositAmount
          .mul(secondBlidPerBlock)
          .mul(blockCountUser2)
          .div(ethers.utils.parseEther('1'));

        expect(claimableAmount1).to.be.equal(
          beforeExpectUser1Amount,
          'ClaimableBLID amout for user1',
        );
        expect(claimableAmount2).to.be.equal(
          beforeExpectUser2Amount,
          'ClaimableBLID amount for user2',
        );
      });
    });

    describe('first withdraw', async () => {
      before(async () => {
        await time.advanceBlock();
      });

      it("User can't withdraw over balance", async () => {
        const withdrawAmount = user1DepositAmount
          .mul(MaxBlidPerUSD)
          .mul(100)
          .div(ethers.utils.parseEther('1'));

        await expect(storageV21.connect(other1).withdrawBLID(withdrawAmount)).to.be.rejectedWith(
          'E12',
        );
      });

      it('Withdraw of user 1 for OverDepositPerUSD, claimReward will be using MaxBlidPerUSD', async () => {
        const withdrawAmount = user1DepositAmount
          .mul(OverDepositPerUSD)
          .div(MaxBlidPerUSD.add(OverDepositPerUSD));
        const beforeBlidbalance = await blid.balanceOf(other1.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const claimableBLIDAmount = user1DepositAmount
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const claimableBLIDAmountStorage = await storageV21.getBoostingClaimableBLID(
          other1.address,
        );

        const tx = await storageV21.connect(other1).withdrawBLID(withdrawAmount);

        const afterBlidbalance = await blid.balanceOf(other1.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.add(withdrawAmount).add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect(claimableBLIDAmountStorage).to.be.equal(
          claimableBLIDAmount,
          'Claimed BLID should be matched with storage',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });

      it('Withdraw of user 2 for 10%, claimReward will be using MaxBlidPerUSD', async () => {
        await time.advanceBlock();

        const withdrawAmount = (await storageV21.balanceOf(other2.address))
          .mul(MaxBlidPerUSD)
          .div(10)
          .div(ethers.utils.parseEther('1'));
        const beforeBlidbalance = await blid.balanceOf(other2.address);

        const blockCountUser2 = (await ethers.provider.getBlockNumber()) - startBlockUser2 + 1;
        const claimableBLIDAmount = user2DepositAmount
          .mul(secondBlidPerBlock)
          .mul(blockCountUser2)
          .div(ethers.utils.parseEther('1'));
        const claimableBLIDAmountStorage = await storageV21.getBoostingClaimableBLID(
          other2.address,
        );

        const tx = await storageV21.connect(other2).withdrawBLID(withdrawAmount);

        const afterBlidbalance = await blid.balanceOf(other2.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.add(withdrawAmount).add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect(claimableBLIDAmountStorage).to.be.equal(
          claimableBLIDAmount,
          'Claimed BLID should be matched with storage',
        );

        startBlockUser2 = await ethers.provider.getBlockNumber();
      });
    });

    describe('Change USD Rate', async () => {
      before(async () => {
        await time.advanceBlock();
        user1DepositAmount = await calcDepositBLIDAmount(other1.address, secondMaxBlidPerUSD);
        user2DepositAmount = await calcDepositBLIDAmount(other2.address, secondMaxBlidPerUSD);
      });

      it('Update USD Rate', async () => {
        let depositUser1: BigNumber = await storageV21.balanceOf(other1.address);
        let depositUser2: BigNumber = await storageV21.balanceOf(other2.address);

        const tx = await aggregator3.connect(owner).updateRate('8', secondUSDRate.toString());
        await tx.wait(1);

        let depositUser1New: BigNumber = await storageV21.balanceOf(other1.address);
        let depositUser2New: BigNumber = await storageV21.balanceOf(other2.address);

        expect(depositUser1New).to.be.equal(
          depositUser1.div(firstUSDRate).mul(secondUSDRate),
          'usdDeposit amount should be changed',
        );
        expect(depositUser2New).to.be.equal(
          depositUser2.div(firstUSDRate).mul(secondUSDRate),
          'usdDeposit amount should be changed',
        );
      });

      it('ClamableBLID sould be calculated with old USD Rate', async () => {
        await time.advanceBlock();

        const claimableAmount1 = await storageV21.getBoostingClaimableBLID(other1.address);
        const claimableAmount2 = await storageV21.getBoostingClaimableBLID(other2.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const blockCountUser2 = (await ethers.provider.getBlockNumber()) - startBlockUser2 + 1;

        const beforeExpectUser1Amount = user1DepositAmount
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const beforeExpectUser2Amount = user2DepositAmount
          .mul(secondBlidPerBlock)
          .mul(blockCountUser2)
          .div(ethers.utils.parseEther('1'));

        expect(claimableAmount1).to.be.equal(
          beforeExpectUser1Amount,
          'ClaimableBLID amout for user1',
        );
        expect(claimableAmount2).to.be.equal(
          beforeExpectUser2Amount,
          'ClaimableBLID amount for user2',
        );
      });

      it('claim BLID for user1 with old USD Rate', async () => {
        const beforeBlidbalance = await blid.balanceOf(other1.address);
        const claimableBlid = await storageV21.getBoostingClaimableBLID(other1.address);

        const tx = await storageV21.connect(other1).claimBoostingRewardBLID();

        const afterBlidbalance = await blid.balanceOf(other1.address);
        expect(afterBlidbalance).to.be.above(
          beforeBlidbalance,
          'BLID balance of other should be increased',
        );

        expect(claimableBlid).to.be.equal(
          afterBlidbalance.sub(beforeBlidbalance),
          'ClaimableBLID should be the same as claim amount',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });

      it('claim BLID for user2 with old USD Rate', async () => {
        await time.advanceBlock();
        const beforeBlidbalance = await blid.balanceOf(other2.address);
        const claimableBlid = await storageV21.getBoostingClaimableBLID(other2.address);

        const tx = await storageV21.connect(other2).claimBoostingRewardBLID();

        const afterBlidbalance = await blid.balanceOf(other2.address);
        expect(afterBlidbalance).to.be.above(
          beforeBlidbalance,
          'BLID balance of other should be increased',
        );

        expect(claimableBlid).to.be.equal(
          afterBlidbalance.sub(beforeBlidbalance),
          'ClaimableBLID should be the same as claim amount',
        );

        startBlockUser2 = await ethers.provider.getBlockNumber();
      });

      it('ClamableBLID sould be calculated with new USD Rate', async () => {
        await time.advanceBlock();
        await time.advanceBlock();
        await time.advanceBlock();
        await time.advanceBlock();
        user1DepositAmount = await calcDepositBLIDAmount(other1.address, secondMaxBlidPerUSD);
        user2DepositAmount = await calcDepositBLIDAmount(other2.address, secondMaxBlidPerUSD);

        const claimableAmount1 = await storageV21.getBoostingClaimableBLID(other1.address);
        const claimableAmount2 = await storageV21.getBoostingClaimableBLID(other2.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const blockCountUser2 = (await ethers.provider.getBlockNumber()) - startBlockUser2 + 1;

        const beforeExpectUser1Amount = user1DepositAmount
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const beforeExpectUser2Amount = user2DepositAmount
          .mul(secondBlidPerBlock)
          .mul(blockCountUser2)
          .div(ethers.utils.parseEther('1'));

        expect(claimableAmount1).to.be.equal(
          beforeExpectUser1Amount,
          'ClaimableBLID amout for user1',
        );
        expect(claimableAmount2).to.be.equal(
          beforeExpectUser2Amount,
          'ClaimableBLID amount for user2',
        );
      });
    });

    describe('second withdraw', async () => {
      before(async () => {
        await time.advanceBlock();
      });

      it('Withdraw of user 1, claimReward will be using secondMaxBlidPerUSD', async () => {
        const withdrawAmount = (await calcDepositBLIDAmount(other1.address, secondMaxBlidPerUSD))
          .mul(amountUSDTDeposit)
          .div(10)
          .div(ethers.utils.parseEther('1'));
        const beforeBlidbalance = await blid.balanceOf(other1.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const claimableBLIDAmount = (
          await calcDepositBLIDAmount(other1.address, secondMaxBlidPerUSD)
        )
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const claimableBLIDAmountStorage = await storageV21.getBoostingClaimableBLID(
          other1.address,
        );

        const tx = await storageV21.connect(other1).withdrawBLID(withdrawAmount);

        const afterBlidbalance = await blid.balanceOf(other1.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.add(withdrawAmount).add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect(claimableBLIDAmountStorage).to.be.equal(
          claimableBLIDAmount,
          'Claimed BLID should be matched with storage',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });
    });

    describe('Change MaxBLIDPerUSD again (back)', async () => {
      before(async () => {
        await time.advanceBlock();
      });

      it('update boosting info', async () => {
        const tx = await storageV21
          .connect(owner)
          .setBoostingInfo(MaxBlidPerUSD, secondBlidPerBlock);
        await tx.wait(1);

        const _maxBlidPerUSD = await storageV21.maxBlidPerUSD();
        expect(_maxBlidPerUSD).to.be.equal(MaxBlidPerUSD, 'MaxBlidPerUSD does not udpated');
      });

      it('ClamableBLID sould be calculated with secondMaxBlidPerUSD', async () => {
        await time.advanceBlock();

        const claimableAmount1 = await storageV21.getBoostingClaimableBLID(other1.address);
        const claimableAmount2 = await storageV21.getBoostingClaimableBLID(other2.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const blockCountUser2 = (await ethers.provider.getBlockNumber()) - startBlockUser2 + 1;

        const beforeExpectUser1Amount = (
          await calcDepositBLIDAmount(other1.address, secondMaxBlidPerUSD)
        )
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const beforeExpectUser2Amount = (
          await calcDepositBLIDAmount(other2.address, secondMaxBlidPerUSD)
        )
          .mul(secondBlidPerBlock)
          .mul(blockCountUser2)
          .div(ethers.utils.parseEther('1'));

        expect(claimableAmount1).to.be.equal(
          beforeExpectUser1Amount,
          'ClaimableBLID amout for user1',
        );
        expect(claimableAmount2).to.be.equal(
          beforeExpectUser2Amount,
          'ClaimableBLID amount for user2',
        );
      });
    });

    describe('third deposit', async () => {
      before(async () => {
        await time.advanceBlock();
      });

      it('deposit of user 1, claimReward will be using secondMaxBlidPerUSD', async () => {
        const depositAmount = (await calcDepositBLIDAmount(other1.address, secondMaxBlidPerUSD))
          .mul(amountUSDTDeposit)
          .div(10)
          .div(ethers.utils.parseEther('1'));
        const beforeBlidbalance = await blid.balanceOf(other1.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const claimableBLIDAmount = (
          await calcDepositBLIDAmount(other1.address, secondMaxBlidPerUSD)
        )
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const claimableBLIDAmountStorage = await storageV21.getBoostingClaimableBLID(
          other1.address,
        );

        const tx = await storageV21.connect(other1).depositBLID(depositAmount);

        const afterBlidbalance = await blid.balanceOf(other1.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.sub(depositAmount).add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect(claimableBLIDAmountStorage).to.be.equal(
          claimableBLIDAmount,
          'Claimed BLID should be matched with storage',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });
    });

    describe('fourth withdraw', async () => {
      before(async () => {
        await time.advanceBlock();
      });

      it('withdraw of user 1, claimReward will be using MaxBlidPerUSD', async () => {
        const withdrawAmount = (await calcDepositBLIDAmount(other1.address, MaxBlidPerUSD))
          .mul(amountUSDTDeposit)
          .div(10)
          .div(ethers.utils.parseEther('1'));
        const beforeBlidbalance = await blid.balanceOf(other1.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const claimableBLIDAmount = (await calcDepositBLIDAmount(other1.address, MaxBlidPerUSD))
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const claimableBLIDAmountStorage = await storageV21.getBoostingClaimableBLID(
          other1.address,
        );

        const tx = await storageV21.connect(other1).withdrawBLID(withdrawAmount);

        const afterBlidbalance = await blid.balanceOf(other1.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.add(withdrawAmount).add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect(claimableBLIDAmountStorage).to.be.equal(
          claimableBLIDAmount,
          'Claimed BLID should be matched with storage',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });
    });

    describe('Deposit USDT', async () => {
      before(async () => {
        await time.advanceBlock();
      });

      it('Change MaxBlidPerUSD as secondMaxBlidPerUSD', async () => {
        const tx = await storageV21
          .connect(owner)
          .setBoostingInfo(secondMaxBlidPerUSD, secondBlidPerBlock);
        await tx.wait(1);
      });

      it('user deposit USDT, claimReward will be using MaxBlidPerUSD', async () => {
        await time.advanceBlock();

        const beforeBlidbalance = await blid.balanceOf(other1.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const claimableBLIDAmount = (await calcDepositBLIDAmount(other1.address, MaxBlidPerUSD))
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const claimableBLIDAmountStorage = await storageV21.getBoostingClaimableBLID(
          other1.address,
        );

        await storageV21.connect(other1).deposit(amountUSDTDeposit, usdt.address);

        const afterBlidbalance = await blid.balanceOf(other1.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect(claimableBLIDAmountStorage).to.be.equal(
          claimableBLIDAmount,
          'Claimed BLID should be matched with storage',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });

      it('withdraw of user 1, claimReward will be using secondMaxBlidPerUSD', async () => {
        await time.advanceBlock();

        const withdrawAmount = (await calcDepositBLIDAmount(other1.address, MaxBlidPerUSD))
          .mul(amountUSDTDeposit)
          .div(10)
          .div(ethers.utils.parseEther('1'));
        const beforeBlidbalance = await blid.balanceOf(other1.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const claimableBLIDAmount = (
          await calcDepositBLIDAmount(other1.address, secondMaxBlidPerUSD)
        )
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const claimableBLIDAmountStorage = await storageV21.getBoostingClaimableBLID(
          other1.address,
        );

        const tx = await storageV21.connect(other1).withdrawBLID(withdrawAmount);

        const afterBlidbalance = await blid.balanceOf(other1.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.add(withdrawAmount).add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect(claimableBLIDAmountStorage).to.be.equal(
          claimableBLIDAmount,
          'Claimed BLID should be matched with storage',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });
    });

    describe('Withdraw USDT', async () => {
      before(async () => {
        await time.advanceBlock();
      });

      it('Change MaxBlidPerUSD as MaxBlidPerUSD', async () => {
        const tx = await storageV21
          .connect(owner)
          .setBoostingInfo(MaxBlidPerUSD, secondBlidPerBlock);
        await tx.wait(1);
      });

      it('user withdraw USDT, claimReward will be using secondMaxBlidPerUSD', async () => {
        await time.advanceBlock();

        const beforeBlidbalance = await blid.balanceOf(other1.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const claimableBLIDAmount = (
          await calcDepositBLIDAmount(other1.address, secondMaxBlidPerUSD)
        )
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const claimableBLIDAmountStorage = await storageV21.getBoostingClaimableBLID(
          other1.address,
        );

        await storageV21.connect(other1).withdraw(amountUSDTDeposit.mul(3).div(2), usdt.address);

        const afterBlidbalance = await blid.balanceOf(other1.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect(claimableBLIDAmountStorage).to.be.equal(
          claimableBLIDAmount,
          'Claimed BLID should be matched with storage',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });

      it('withdraw of user 1, claimReward will be using MaxBlidPerUSD', async () => {
        await time.advanceBlock();

        const withdrawAmount = (await calcDepositBLIDAmount(other1.address, MaxBlidPerUSD))
          .mul(amountUSDTDeposit)
          .div(10)
          .div(ethers.utils.parseEther('1'));
        const beforeBlidbalance = await blid.balanceOf(other1.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const claimableBLIDAmount = (await calcDepositBLIDAmount(other1.address, MaxBlidPerUSD))
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const claimableBLIDAmountStorage = await storageV21.getBoostingClaimableBLID(
          other1.address,
        );

        const tx = await storageV21.connect(other1).withdrawBLID(withdrawAmount);

        const afterBlidbalance = await blid.balanceOf(other1.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.add(withdrawAmount).add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect(claimableBLIDAmountStorage).to.be.equal(
          claimableBLIDAmount,
          'Claimed BLID should be matched with storage',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });
    });

    describe('withdraw total', async () => {
      before(async () => {
        await time.advanceBlock();
      });

      it('withdraw of user 1', async () => {
        const withdrawAmount = await storageV21.getBoostingBLIDAmount(other1.address);
        const beforeBlidbalance = await blid.balanceOf(other1.address);

        const blockCountUser1 = (await ethers.provider.getBlockNumber()) - startBlockUser1 + 1;
        const claimableBLIDAmount = (await calcDepositBLIDAmount(other1.address, MaxBlidPerUSD))
          .mul(secondBlidPerBlock)
          .mul(blockCountUser1)
          .div(ethers.utils.parseEther('1'));
        const claimableBLIDAmountStorage = await storageV21.getBoostingClaimableBLID(
          other1.address,
        );

        await storageV21.connect(other1).withdrawBLID(withdrawAmount);

        const afterBlidbalance = await blid.balanceOf(other1.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.add(withdrawAmount).add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect(claimableBLIDAmountStorage).to.be.equal(
          claimableBLIDAmount,
          'Claimed BLID should be matched with storage',
        );

        expect((await storageV21.getBoostingBLIDAmount(other1.address)).toString()).to.be.equal(
          '0',
        );

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });

      it('withdraw of user 2', async () => {
        await time.advanceBlock();

        const withdrawAmount = await storageV21.getBoostingBLIDAmount(other2.address);
        const beforeBlidbalance = await blid.balanceOf(other2.address);

        const claimableBLIDAmount = await storageV21.getBoostingClaimableBLID(other2.address);

        await storageV21.connect(other2).withdrawBLID(withdrawAmount);

        const afterBlidbalance = await blid.balanceOf(other2.address);

        expect(afterBlidbalance).to.be.equal(
          beforeBlidbalance.add(withdrawAmount).add(claimableBLIDAmount),
          'Claimed BLID',
        );

        expect((await storageV21.getBoostingBLIDAmount(other2.address)).toString()).to.be.equal(
          '0',
        );

        startBlockUser2 = await ethers.provider.getBlockNumber();
      });
    });

    describe('Claim Final', async () => {
      it('claim BLID for user1', async () => {
        await time.advanceBlock();
        const beforeBlidbalance = await blid.balanceOf(other1.address);
        const claimableBlid = await storageV21.getBoostingClaimableBLID(other1.address);

        const tx = await storageV21.connect(other1).claimBoostingRewardBLID();

        const afterBlidbalance = await blid.balanceOf(other1.address);

        expect(beforeBlidbalance).to.be.equal(
          afterBlidbalance,
          'BLID balance should not be changed',
        );

        expect(claimableBlid.toString()).to.be.equal('0', 'ClaimableBLID should be 0');

        startBlockUser1 = await ethers.provider.getBlockNumber();
      });

      it('claim BLID for user2', async () => {
        await time.advanceBlock();
        const beforeBlidbalance = await blid.balanceOf(other2.address);
        const claimableBlid = await storageV21.getBoostingClaimableBLID(other2.address);

        const tx = await storageV21.connect(other2).claimBoostingRewardBLID();

        const afterBlidbalance = await blid.balanceOf(other2.address);

        expect(beforeBlidbalance).to.be.equal(
          afterBlidbalance,
          'BLID balance should not be changed',
        );

        expect(claimableBlid.toString()).to.be.equal('0', 'ClaimableBLID should be 0');

        startBlockUser2 = await ethers.provider.getBlockNumber();
      });
    });

    describe("Total BLID supply", async () => {
      before(async () => {
        await time.advanceBlock();
      });

      it("after first BLID deposit for boosting", async () => {
        const beforeTotalBlidSupply = await storageV21.totalSupplyBLID();

        expect(beforeTotalBlidSupply).to.be.equal(
          0,
          "Total BLID supply should be 0"
        );

        await storageV21
          .connect(other1)
          .deposit(amountUSDTDeposit, usdt.address);

        const depositAmount = amountUSDTDeposit
          .mul(MaxBlidPerUSD.add(OverDepositPerUSD))
          .div(ethers.utils.parseEther("1"));

        await storageV21.connect(other1).depositBLID(depositAmount);

        const afterTotalBlidSupply = await storageV21.totalSupplyBLID();
        expect(afterTotalBlidSupply).to.be.equal(
          beforeTotalBlidSupply.add(depositAmount),
          "Total BLID supply should be updated after BLID deposit"
        );
      });

      it("after second BLID deposit for boosting", async () => {
        const beforeTotalBlidSupply = await storageV21.totalSupplyBLID();

        await storageV21
          .connect(other2)
          .deposit(amountUSDTDeposit, usdt.address);

        const depositAmount = amountUSDTDeposit
          .mul(MaxBlidPerUSD.add(OverDepositPerUSD))
          .div(ethers.utils.parseEther("1"));

        await storageV21.connect(other2).depositBLID(depositAmount);

        const afterTotalBlidSupply = await storageV21.totalSupplyBLID();
        expect(afterTotalBlidSupply).to.be.equal(
          beforeTotalBlidSupply.add(depositAmount),
          "Total BLID supply should be updated after BLID deposit"
        );
      });

      it("after claim BLID for user1", async () => {
        const beforeTotalBlidSupply = await storageV21.totalSupplyBLID();

        await storageV21.connect(other1).claimBoostingRewardBLID();

        const afterTotalBlidSupply = await storageV21.totalSupplyBLID();
        expect(afterTotalBlidSupply).to.be.equal(
          beforeTotalBlidSupply,
          "Total BLID supply should not be changed"
        );
      });

      it("after claim BLID for user2", async () => {
        const beforeTotalBlidSupply = await storageV21.totalSupplyBLID();

        await storageV21.connect(other2).claimBoostingRewardBLID();

        const afterTotalBlidSupply = await storageV21.totalSupplyBLID();
        expect(afterTotalBlidSupply).to.be.equal(
          beforeTotalBlidSupply,
          "Total BLID supply should not be changed"
        );
      });

      it("after withdraw BLID for user1 for OverDepositPerUSD", async () => {
        const beforeTotalBlidSupply = await storageV21.totalSupplyBLID();

        const withdrawAmount = user1DepositAmount
          .mul(OverDepositPerUSD)
          .div(MaxBlidPerUSD.add(OverDepositPerUSD));

        await storageV21.connect(other1).withdrawBLID(withdrawAmount);

        const afterTotalBlidSupply = await storageV21.totalSupplyBLID();
        expect(afterTotalBlidSupply).to.be.equal(
          beforeTotalBlidSupply.sub(withdrawAmount),
          "Total BLID supply should be updated after BLID withdraw"
        );
      });

      it("after withdraw BLID for user2 for 10%", async () => {
        const beforeTotalBlidSupply = await storageV21.totalSupplyBLID();

        const withdrawAmount = (await storageV21.balanceOf(other2.address))
          .mul(MaxBlidPerUSD)
          .div(10)
          .div(ethers.utils.parseEther("1"));

        await storageV21.connect(other2).withdrawBLID(withdrawAmount);

        const afterTotalBlidSupply = await storageV21.totalSupplyBLID();
        expect(afterTotalBlidSupply).to.be.equal(
          beforeTotalBlidSupply.sub(withdrawAmount),
          "Total BLID supply should be updated after BLID withdraw"
        );
      });

      it("after withdraw BLID for user 1, claimReward will be using secondMaxBlidPerUSD", async () => {
        const beforeTotalBlidSupply = await storageV21.totalSupplyBLID();

        const withdrawAmount = (
          await calcDepositBLIDAmount(other1.address, secondMaxBlidPerUSD)
        )
          .mul(amountUSDTDeposit)
          .div(10)
          .div(ethers.utils.parseEther("1"));

        await storageV21.connect(other1).withdrawBLID(withdrawAmount);

        const afterTotalBlidSupply = await storageV21.totalSupplyBLID();
        expect(afterTotalBlidSupply).to.be.equal(
          beforeTotalBlidSupply.sub(withdrawAmount),
          "Total BLID supply should be updated after BLID withdraw"
        );
      });

      it("after total withdraw for user 1", async () => {
        const beforeTotalBlidSupply = await storageV21.totalSupplyBLID();

        const withdrawAmount = await storageV21.getBoostingBLIDAmount(
          other1.address
        );

        await storageV21.connect(other1).withdrawBLID(withdrawAmount);

        const afterTotalBlidSupply = await storageV21.totalSupplyBLID();
        expect(afterTotalBlidSupply).to.be.equal(
          beforeTotalBlidSupply.sub(withdrawAmount),
          "Total BLID supply should be updated after BLID withdraw"
        );
      });

      it("after total withdraw for user 2", async () => {
        const beforeTotalBlidSupply = await storageV21.totalSupplyBLID();

        const withdrawAmount = await storageV21.getBoostingBLIDAmount(
          other2.address
        );

        await storageV21.connect(other2).withdrawBLID(withdrawAmount);

        const afterTotalBlidSupply = await storageV21.totalSupplyBLID();
        expect(afterTotalBlidSupply).to.be.equal(
          beforeTotalBlidSupply.sub(withdrawAmount),
          "Total BLID supply should be updated after BLID withdraw"
        );
      });
    });
  });
});
