import { adminable } from "./suites/adminable.test";
import { bolide } from "./suites/bolide.test";
import { storageV21 } from "./suites/storageV21.test";
import { storageV3 } from "./suites/storageV3.test";
import { logic_liquidity } from "./suites/logic.liquidity.test";
import { logic_masterchef } from "./suites/logic.MasterChef.test";
import { logic_swap } from "./suites/logic.swap.test";
import { versionable } from "./suites/versionable.test";
import { lbf_strategy_farmingPair } from "./suites/lbf_strategy.farmingPair.test";
import { lbf_strategy } from "./suites/lbf_strategy.test";
import { lbf_strategyV2_testnet } from "./suites/lbf_strategyV2.testnet.test";
import { lbf_strategyV2_mainnet } from "./suites/lbf_strategyV2.mainnet.test";
import { eth_strategy } from "./suites/eth_strategy.test";
import { multicallToLogic } from "./suites/multicall.test";
import { storage_boosting } from "./suites/storage.boosting.test";
import { storage_upgrade } from "./suites/storage.upgrade.test";
import { crosschain_deposit } from "./suites/crosschain_deposit.test";
import { storageV3_leaveToken } from "./suites/storageV3.leaveToken.test";
import { swap_environment } from "./suites/swap.environment";
import { strategy_dforce } from "./suites/strategy_dforce.test";
import { upgrade } from "./suites/upgrade.test";

describe("hardhatAdminable", adminable); // Hardhat
describe("hardhatBolide", bolide); // Hardhat
describe("hardhatStorageV21", storageV21); // Hardhat
describe("hardhatStorageV3", storageV3); // Hardhat
describe("hardhatStorageUpgrade", storage_upgrade); // Hardhat
describe("hardhatStorageBoosting", storage_boosting); // Hardhat
describe("hardhatStorageV3LeaveToken", storageV3_leaveToken); // hardhat
describe("hardhatVersionable", versionable); // Hardhat
describe("hardhatLendBorrowFarmingPair", lbf_strategy_farmingPair); // Hardhat
describe("LendBorrowFarmStrategy", lbf_strategy); // BSC Testnet
describe("LendBorrowFarmStrategyV2Testnet", lbf_strategyV2_testnet); // BSC Testnet
describe("LendBorrowFarmStrategyV2Mainnet", lbf_strategyV2_mainnet); // BSC Mainnet
describe("DForceStrategy", strategy_dforce); // Polygon Mainnet
describe("Strategy with ETH", eth_strategy); // BSC Mainnet
describe("Multicall in Strategy to Logic", multicallToLogic); // BSC Testnet
describe("Logic Contract - liquidity", logic_liquidity); // BSC Mainnet
describe("Logic Contract - Swap", logic_swap); // BST Testnet
describe("Logic Contract - MasterChef", logic_masterchef); // BSC Testnet
describe("Crosschain Deposit", crosschain_deposit); // Rinkybe, BSC Testnet
describe("SwapEnvironment", swap_environment); // BSC Testnet
describe("Upgrade", upgrade); // BSC Mainnet
