/*******************************************
 * Test on BSC Testnet
 * Owner contract should have 0.1 BNB
 *******************************************/

import dotenv from "dotenv";
import {ethers} from "hardhat";
import {MultiLogic, MultiLogic__factory} from "../../typechain-types";
dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(
  process.env.MAINNET_POLYGON_PROVIDER_URL,
  {name: "matic", chainId: 137}
);

// Your Ethereum wallet private key
const owner = process.env.DEPLOYER_PRIVATE_KEY
  ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider)
  : ethers.Wallet.createRandom();

// Variables for deployed contract
let automation: MultiLogic, tx;

export const upgrade = () => {
  before(async () => {
    automation = MultiLogic__factory.connect(
      "0xbF2112960147b2cD67970Ed45a8E7B6341326f18",
      owner
    ) as MultiLogic;
  });

  describe("Preparation", async () => {
    xit("Upgrade Contract", async () => {
      tx = await automation
        .connect(owner)
        .upgradeTo("0x2BA7E1dd795F5d033410771341FBcaB0Ff13EB55");
      await tx.wait(1);
    });

    it("Get manipulate data", async () => {
      const logic1 = "0x27DF8DfF5CF14dcFB8c851d1D40fA25a93BeA76B";
      const logic2 = "0xb7328a32b568ba7f60e257c544d4bbdd1498904e";
      const SupplyToken = "0x0000000000000000000000000000000000000000";

      console.log(await automation.getTokenAvailable(SupplyToken, logic1));
      console.log(await automation.getTokenAvailable(SupplyToken, logic2));
      console.log(await automation.getTokenTaken(SupplyToken, logic1));
      console.log(await automation.getTokenTaken(SupplyToken, logic2));
    });
  });
};
