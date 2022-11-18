require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-web3');
require('@openzeppelin/hardhat-upgrades');

module.exports = {
  solidity: {
    version: '0.8.13',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
};
