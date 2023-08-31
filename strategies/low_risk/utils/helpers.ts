import {run} from "hardhat";
import {BigNumber} from "ethers";
import {NomicLabsHardhatPluginError} from "hardhat/plugins";

export const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const logValue = (title: string, value: BigNumber | string | number) => {
  console.log(title.padEnd(30).padStart(41), ":", value.toString());
};

// Verify helper function
export const verify = async (address: string, param: any = []) => {
  try {
    console.log("Verifying: ", address);
    await run("verify", {
      address: address,
      constructorArguments: param,
    });
  } catch (error: any) {
    if (
      error instanceof NomicLabsHardhatPluginError &&
      error.message.includes("Reason: Already Verified")
    ) {
      console.log("Already verified, skipping...");
    } else {
      console.error(error);
    }
  }
};

// Wait keypress
export const keypress = async (
  text: string = "Press any key to continue..."
) => {
  process.stdout.write(text);
  process.stdin.setRawMode(true);
  return new Promise((resolve) =>
    process.stdin.once("data", (data) => {
      const byteArray = [...data];
      if (byteArray.length > 0 && byteArray[0] === 3) {
        console.log("\n^C");
        process.exit(1);
      }
      process.stdin.setRawMode(false);
      process.stdout.write("\r" + " ".repeat(text.length) + "\r");
      resolve(() => {});
    })
  );
};
