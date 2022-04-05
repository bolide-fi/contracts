const { contract, accounts } = require('@openzeppelin/test-environment');
const { time } = require('@openzeppelin/test-helpers');
const [owner] = accounts;

const Bolide = contract.fromArtifact("Bolide");
const TokenVesting = contract.fromArtifact("TokenVesting");
const VestingController = contract.fromArtifact("VestingController");

require('chai')
     .use(require('chai-as-promised'))
     .should()


const day = 60 * 60 * 24;

describe('Bolide', () => {
     let blid, timestamp, result, vesting, vestingController
     before(async () => {
          vestingController = await VestingController.new({ from: owner })
          blid = await Bolide.new(vestingController.address, accounts[9], { from: owner })
          vestingController.addBLID(blid.address, { from: owner })
          startTime = (await time.latest()).add(time.duration.days(1))
          timestamp = Date.now();
          timestamp = timestamp - timestamp % (day * 1000);
     })

     describe('deployment', async () => {

          it('deploys successfully', async () => {
               const address = await blid.address
               assert.notEqual(address, 0x0)
               assert.notEqual(address, '')
               assert.notEqual(address, null)
               assert.notEqual(address, undefined)
          })

          it('has a name', async () => {
               const name = await blid.name()
               assert.equal(name, 'Bolide')
          })

          it('has a symbol', async () => {
               const name = await blid.symbol()
               assert.equal(name, 'BLID')
          })

          it('totalSupply equal 1000000000000000000000000', async () => {
               let totalSupply = await blid.totalSupply.call();
               assert.equal("1000000000000000000000000", totalSupply.toString())
          })


     })

     describe('mint, transfer, burn', async () => {
          it('non-owner cannot mint ', async () => {
               await vestingController.vest(accounts[1], 365 * 5 * 20, timestamp / 1000, day, 365 * 5, { from: accounts[1] }).should.be.rejectedWith("Returned error: VM Exception while processing transaction: revert Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner.");
          })

          it('owner can vest ', async () => {
               result = await vestingController.vest(accounts[1], 365 * 5 * 20, timestamp / 1000, day, 365 * 5, { from: owner })
               result = result.logs[0].args.VestingContract;
               vesting = await TokenVesting.at(result);
          })

          it('balance is zero at first', async () => {
               let balance = await vesting.releasableAmount()
               assert.equal((0).toString(), balance.toString())
               let flag = false;
               try {
                    await vesting.release()
               } catch (error) {
                    error.message.should.equal('Returned error: VM Exception while processing transaction: revert TokenVesting: no tokens are due -- Reason given: TokenVesting: no tokens are due.')
                    flag = true;
               }
               flag.should.be.true;
               balance = await (blid.balanceOf.call(accounts[1]));
               assert.equal((0).toString(), balance.toString())
          })

          it('after one day the balance is increased by yes 1 / (365 * 5)', async () => {
               await time.increaseTo(startTime.add(time.duration.seconds(1)))
               await vesting.release()
               let balance = await (blid.balanceOf.call(accounts[1]));
               assert.equal((20).toString(), balance.toString())
          })

          it('cannot transfer more than the balance', async () => {
               await blid.transfer(accounts[0], 1000, { from: accounts[1] }).should.be.rejectedWith("Returned error: VM Exception while processing transaction: revert ERC20: transfer amount exceeds balance -- Reason given: ERC20: transfer amount exceeds balance.");
          })

          it('transfer', async () => {
               const result = await (blid.transfer(accounts[0], 10, { from: accounts[1] }))
               balance = await blid.balanceOf(accounts[1]);
               assert.equal((10).toString(), balance.toString())
               balance = await blid.balanceOf(accounts[0]);
               assert.equal((10).toString(), balance.toString())
          })

          it('cannot burn more than the balance', async () => {
               await blid.burn(100, { from: accounts[1] }).should.be.rejected;
          })

          it('burn', async () => {
               await (blid.burn(10, { from: accounts[1] }))
               balance = await blid.balanceOf(accounts[1]);
               assert.equal((0).toString(), balance.toString())
          })

          it('approve', async () => {
               await blid.approve(accounts[1], 10, { from: accounts[0] })
               balance = await blid.allowance(accounts[0], accounts[1]);
               assert.equal((10).toString(), balance.toString())
          })

          it('transferFrom exeption', async () => {
               await blid.transferFrom(accounts[1], accounts[0], 10, { from: accounts[1] }).should.be.rejectedWith("Returned error: VM Exception while processing transaction: revert ERC20: transfer amount exceeds balance -- Reason given: ERC20: transfer amount exceeds balance.");
               await blid.transferFrom(accounts[1], accounts[1], 10, { from: accounts[1] }).should.be.rejectedWith("Returned error: VM Exception while processing transaction: revert ERC20: transfer amount exceeds balance -- Reason given: ERC20: transfer amount exceeds balance.");
               await blid.transferFrom(accounts[0], accounts[1], 20, { from: accounts[1] }).should.be.rejectedWith("Returned error: VM Exception while processing transaction: revert ERC20: transfer amount exceeds balance -- Reason given: ERC20: transfer amount exceeds balance.");
          })

          it('transferFrom', async () => {
               await blid.transferFrom(accounts[0], accounts[1], 10, { from: accounts[1] })
               balance = await blid.balanceOf(accounts[1]);
               assert.equal((10).toString(), balance.toString())
          })

          it('after two days owner can not mint', async () => {
               await time.increaseTo(startTime.add(time.duration.days(1)).add(time.duration.seconds(1)))
               await vestingController.vest(accounts[1], 365 * 5 * 20, timestamp, day, 365 * 5, timestamp + 365 * 5 * day, { from: owner }).should.be.rejected;
          })

          it('after five year balance equal the whole amount of minted tokens', async () => {
               await time.increaseTo(startTime.add(time.duration.years(5)).add(time.duration.seconds(1)))
               await vesting.release()
               let balance = await blid.balanceOf.call(accounts[1]);
               assert.equal((365 * 5 * 20 - 10).toString(), balance.toString())
          })
     })
});
