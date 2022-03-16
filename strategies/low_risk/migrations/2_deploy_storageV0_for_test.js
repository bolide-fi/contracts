
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const StorageV0 = artifacts.require("StorageV0");

module.exports = async function (deployer, something, accounts) {
  await deployProxy(StorageV0, [accounts[1]], { deployer: deployer, initializer: 'initialize' });
};