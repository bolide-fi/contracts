const { time } = require('@openzeppelin/test-helpers');
const ethers = require('ethers');
const MasterBlid = artifacts.require('MasterBlid');
const MockBEP20 = artifacts.require('libs/MockBEP20');
const Timelock = artifacts.require('Timelock');

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

contract('MasterChef', ([alice, bob, carol, dev, minter]) => {
  let currentBlock;
  beforeEach(async () => {
    this.blid = await MockBEP20.new('Bolide', 'BLID', '10000000000000', { from: minter });

    this.lp1 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
    this.lp2 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
    this.lp3 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
    this.chef = await MasterBlid.new(this.blid.address, minter, '1000', '100', '3600', { from: minter });
    await this.blid.approve(this.chef.address, '1000000000', { from: minter });

    await this.lp1.transfer(bob, '2000', { from: minter });
    await this.lp2.transfer(bob, '2000', { from: minter });
    await this.lp3.transfer(bob, '2000', { from: minter });

    await this.lp1.transfer(alice, '2000', { from: minter });
    await this.lp2.transfer(alice, '2000', { from: minter });
    await this.lp3.transfer(alice, '2000', { from: minter });

    // This block helps avoid timelock logic for pure MasterChef testing
    let timelock = await Timelock.at(await this.chef.timelock());
    let eta = (await time.latest()).add(time.duration.hours(1)).add(time.duration.minutes(1));
    await timelock.queueTransaction(
      this.chef.address, '0', 'transferOwnership(address)',
      encodeParameters(['address'], [minter]), eta, { from: minter },
    );
    await time.increase(time.duration.hours(2));
    await timelock.executeTransaction(
      this.chef.address, '0', 'transferOwnership(address)',
      encodeParameters(['address'], [minter]), eta, { from: minter },
    );
  });

  it('real case', async () => {
    this.lp4 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
    this.lp5 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
    this.lp6 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
    this.lp7 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
    this.lp8 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
    this.lp9 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
    await this.chef.add('2000', this.lp1.address, true, { from: minter });
    await this.chef.add('1000', this.lp2.address, true, { from: minter });
    await this.chef.add('500', this.lp3.address, true, { from: minter });
    await this.chef.add('500', this.lp3.address, true, { from: minter });
    await this.chef.add('500', this.lp3.address, true, { from: minter });
    await this.chef.add('500', this.lp3.address, true, { from: minter });
    await this.chef.add('500', this.lp3.address, true, { from: minter });
    await this.chef.add('100', this.lp3.address, true, { from: minter });
    await this.chef.add('100', this.lp3.address, true, { from: minter });
    assert.equal((await this.chef.poolLength()).toString(), "10");

    currentBlock = parseInt(await time.latestBlock());
    await time.advanceBlockTo(currentBlock + 140);
    await this.lp1.approve(this.chef.address, '1000', { from: alice });
    assert.equal((await this.blid.balanceOf(alice)).toString(), '0');
    await this.chef.deposit(1, '20', { from: alice });
    await this.chef.withdraw(1, '20', { from: alice });
    assert.equal((await this.blid.balanceOf(alice)).toString(), '298');

    await this.blid.approve(this.chef.address, '1000', { from: alice });
    await this.chef.enterStaking('20', { from: alice });
    await this.chef.enterStaking('0', { from: alice });
    await this.chef.enterStaking('0', { from: alice });
    await this.chef.enterStaking('0', { from: alice });
    assert.equal((await this.blid.balanceOf(alice)).toString(), '725');
  })

  it('deposit/withdraw', async () => {
    await this.chef.add('1000', this.lp1.address, true, { from: minter });
    await this.chef.add('1000', this.lp2.address, true, { from: minter });
    await this.chef.add('1000', this.lp3.address, true, { from: minter });

    await this.lp1.approve(this.chef.address, '100', { from: alice });
    await this.chef.deposit(1, '20', { from: alice });
    await this.chef.deposit(1, '0', { from: alice });
    await this.chef.deposit(1, '40', { from: alice });
    await this.chef.deposit(1, '0', { from: alice });
    assert.equal((await this.lp1.balanceOf(alice)).toString(), '1940');
    await this.chef.withdraw(1, '10', { from: alice });
    assert.equal((await this.lp1.balanceOf(alice)).toString(), '1950');
    assert.equal((await this.blid.balanceOf(alice)).toString(), '999');

    await this.lp1.approve(this.chef.address, '100', { from: bob });
    assert.equal((await this.lp1.balanceOf(bob)).toString(), '2000');
    await this.chef.deposit(1, '50', { from: bob });
    assert.equal((await this.lp1.balanceOf(bob)).toString(), '1950');
    await this.chef.deposit(1, '0', { from: bob });
    assert.equal((await this.blid.balanceOf(bob)).toString(), '125');
    await this.chef.emergencyWithdraw(1, { from: bob });
    assert.equal((await this.lp1.balanceOf(bob)).toString(), '2000');
  })

  it('staking/unstaking', async () => {
    await this.chef.add('1000', this.lp1.address, true, { from: minter });
    await this.chef.add('1000', this.lp2.address, true, { from: minter });
    await this.chef.add('1000', this.lp3.address, true, { from: minter });

    await this.lp1.approve(this.chef.address, '10', { from: alice });
    await this.chef.deposit(1, '2', { from: alice }); //0
    await this.chef.withdraw(1, '2', { from: alice }); //1

    await this.blid.approve(this.chef.address, '250', { from: alice });
    await this.chef.enterStaking('240', { from: alice }); //3
    assert.equal((await this.blid.balanceOf(alice)).toString(), '10');
    await this.chef.enterStaking('10', { from: alice }); //4
    assert.equal((await this.blid.balanceOf(alice)).toString(), '249');
    await this.chef.leaveStaking(250);
    assert.equal((await this.blid.balanceOf(alice)).toString(), '749');
  });

  it('set alloc point', async () => {
    await this.chef.add('1000', this.lp1.address, true, { from: minter });
    await this.chef.add('1000', this.lp2.address, true, { from: minter });
    await this.chef.add('1000', this.lp3.address, true, { from: minter });
    await this.chef.set(1, '10000', true, { from: minter });

    await this.lp1.approve(this.chef.address, '100', { from: alice });
    await this.lp1.approve(this.chef.address, '100', { from: bob });
    await this.chef.deposit(1, '100', { from: alice });
    await this.chef.deposit(1, '100', { from: bob });
    await this.chef.deposit(1, '0', { from: alice });
    await this.chef.deposit(1, '0', { from: bob });

    await this.blid.approve(this.chef.address, '100', { from: alice });
    await this.blid.approve(this.chef.address, '100', { from: bob });
    await this.chef.enterStaking('50', { from: alice });
    await this.chef.enterStaking('100', { from: bob });

    await this.chef.updateMultiplier('0', { from: minter });

    await this.chef.enterStaking('0', { from: alice });
    await this.chef.enterStaking('0', { from: bob });
    await this.chef.deposit(1, '0', { from: alice });
    await this.chef.deposit(1, '0', { from: bob });

    assert.equal((await this.blid.balanceOf(alice)).toString(), '1564');
    assert.equal((await this.blid.balanceOf(bob)).toString(), '669');

    currentBlock = parseInt(await time.latestBlock());
    await time.advanceBlockTo(currentBlock + 9);

    await this.chef.enterStaking('0', { from: alice });
    await this.chef.enterStaking('0', { from: bob });
    await this.chef.deposit(1, '0', { from: alice });
    await this.chef.deposit(1, '0', { from: bob });

    assert.equal((await this.blid.balanceOf(alice)).toString(), '1564');
    assert.equal((await this.blid.balanceOf(bob)).toString(), '669');

    await this.chef.leaveStaking('50', { from: alice });
    await this.chef.leaveStaking('100', { from: bob });
    await this.chef.withdraw(1, '100', { from: alice });
    await this.chef.withdraw(1, '100', { from: bob });
  });
});
