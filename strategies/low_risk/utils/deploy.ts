import {ethers, upgrades, network} from "hardhat";
import {sleep, verify} from "../utils/helpers";
import {multisig} from "../utils/multisig";
import {upgradeProxyAbi} from "../data/contracts_abi/upgradeProxy.json";
import {proxyAdminAbi} from "../data/contracts_abi/proxyAdmin.json";
import {OwnableUpgradeableVersionableAbi} from "../data/contracts_abi/ownableUpgradeableVersionableAbi.json";
import "@openzeppelin/hardhat-upgrades";
import {Contract, ContractFactory} from "ethers";
import {DeployProxyOptions} from "@openzeppelin/hardhat-upgrades/dist/utils";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

interface ContractDeployParams {
  gnosisSafeAddress?: string;

  gnosisSafeServiceURL?: string;

  proxyAddress: string;

  contractFactory: string;

  initializer?: string;

  initializerArgs?: any[];

  useUUPS?: boolean;

  version: string;

  description?: string;

  libraries?: Array<{factory: string; address: string}>;
}

interface ContractCreateParams {
  contractFactory: string;

  initializer?: string;

  initializerArgs?: any[];

  libraries?: Array<{factory: string; address: string}>;
}

export async function deployEnvironment(
  config: any,
  version: string,
  gnosisSafeAddress?: string,
  gnosisSafeServiceURL?: string
) {
  console.log(`Deployment to ${config.name} has been started...`);

  for (const library of config.libraries) {
    if (!library.address) {
      library.address = await deployLibrary(library.factory);
    }
  }

  for (const contract of config.contracts) {
    const libraries: any[] = [];

    // Link contract libraries
    if (contract.libraries && contract.libraries.length > 0) {
      for (const libraryFactory of contract.libraries) {
        const library = config.libraries.find(
          (item: any) => item.factory === libraryFactory
        );

        if (!library) {
          throw new Error(
            `Library ${libraryFactory} was not defined on environment ${config.name}`
          );
        }

        libraries.push(library);
      }
    }

    contract.address = await deployContract({
      contractFactory: contract.factory,
      initializer: contract.initializer,
      initializerArgs: contract.initializerArgs,
      proxyAddress: contract.address,
      libraries,
      gnosisSafeAddress,
      gnosisSafeServiceURL,
      useUUPS: true,
      version,
    });
  }

  console.log(`Deployment to ${config.name} has been finished`);
}

export async function deployLibrary(
  libraryFactoryName: string
): Promise<string> {
  const [deployer] = await ethers.getSigners();

  const libraryFactory = await ethers.getContractFactory(libraryFactoryName, {
    signer: deployer,
  });

  const library = await libraryFactory.deploy();
  console.log(
    `Library ${libraryFactoryName} has been deployed to ${library.address}`
  );

  await verify(library.address);

  return library.address;
}

export async function deployContract(
  data: ContractDeployParams
): Promise<string> {
  const {
    gnosisSafeAddress = "",
    gnosisSafeServiceURL = "",
    contractFactory,
    initializer,
    initializerArgs,
    useUUPS,
    version,
    description = "",
    libraries = [],
  } = data;
  let {proxyAddress} = data;

  const [deployer] = await ethers.getSigners();

  const useMultiSig = !!gnosisSafeAddress && !!gnosisSafeServiceURL;

  if (!proxyAddress) {
    console.log("- Deploy Proxy -");

    proxyAddress = await createContract({
      contractFactory,
      initializer,
      initializerArgs,
      libraries,
    });

    if (useMultiSig) {
      const contract = await connectContract(
        contractFactory,
        proxyAddress,
        deployer
      );
      await contract.transferOwnership(gnosisSafeAddress);
    }
  } else {
    await upgradeContract(data);
  }

  console.log("- Set version -", version);
  if (useMultiSig) {
    const provider = new ethers.providers.JsonRpcProvider(
      // @ts-ignore
      network.config.url,
      // @ts-ignore
      {name: network.config.addressesSet, chainId: network.config.chainId!}
    );

    const signer = new ethers.Wallet(
      process.env.DEPLOYER_PRIVATE_KEY!,
      provider
    );

    const contract = await connectContract(
      contractFactory,
      proxyAddress,
      deployer
    );

    await multisig(
      gnosisSafeServiceURL,
      contract,
      "upgradeVersion",
      [version, description],
      JSON.stringify(OwnableUpgradeableVersionableAbi),
      signer
    );
  } else {
    const contract = await connectContract(
      contractFactory,
      proxyAddress,
      deployer
    );
    const tx = await contract.upgradeVersion(version, description);
    await tx.wait(1);
  }

  return proxyAddress;
}

async function connectContract(
  factoryName: string,
  address: string,
  deployer: SignerWithAddress
): Promise<Contract> {
  const module = await import("../typechain-types");

  // @ts-ignore
  const factory = module[`${factoryName}__factory`];

  if (!factory) {
    throw new Error(`Cannot resolve factory name ${factoryName}`);
  }

  return factory.connect(address, deployer);
}

async function prepareFactoryAndParams(data: ContractCreateParams): Promise<{
  ContractFactory: ContractFactory;
  deployOptions: DeployProxyOptions;
}> {
  const {contractFactory, initializer, libraries = []} = data;

  // Contract factory param
  let factoryOptions = {};
  let librariesParam: Record<string, string> = {};

  for (const library of libraries) {
    librariesParam[library.factory] = library.address;
  }

  if (libraries.length > 0) {
    factoryOptions = {
      libraries: librariesParam,
    };
  }

  // Upgrade Param
  let deployOptions = {
    unsafeAllow: [],
    unsafeAllowLinkedLibraries: !!libraries.length,
    initializer,
  };

  const ContractFactory = await ethers.getContractFactory(
    contractFactory,
    factoryOptions
  );

  return {
    ContractFactory,
    deployOptions,
  };
}

async function createContract(data: ContractCreateParams): Promise<string> {
  const {initializerArgs, libraries} = data;

  const {ContractFactory, deployOptions} = await prepareFactoryAndParams(data);

  const proxy = await upgrades.deployProxy(
    ContractFactory,
    initializerArgs,
    deployOptions
  );
  await proxy.deployed();

  const proxyImpl = await upgrades.erc1967.getImplementationAddress(
    proxy.address
  );
  console.log("Proxy:", proxy.address);
  console.log("Implementation:", proxyImpl);

  await sleep(1000);
  await verify(proxy.address);

  return proxy.address;
}

async function upgradeContract(data: ContractDeployParams) {
  const {
    gnosisSafeAddress = "",
    gnosisSafeServiceURL = "",
    contractFactory,
    proxyAddress,
    useUUPS,
    libraries = [],
  } = data;

  const useMultiSig = !!gnosisSafeAddress && !!gnosisSafeServiceURL;

  console.log(`- Upgrade Implementation, useMultiSig = ${useMultiSig} -`);

  const {ContractFactory, deployOptions} = await prepareFactoryAndParams(data);

  if (useMultiSig) {
    const provider = new ethers.providers.JsonRpcProvider(
      // @ts-ignore
      network.config.url,
      // @ts-ignore
      {name: network.config.addressesSet, chainId: network.config.chainId!}
    );

    const signer = new ethers.Wallet(
      process.env.DEPLOYER_PRIVATE_KEY!,
      provider
    );
    const [deployer] = await ethers.getSigners();

    const contractImpl: any = await upgrades.prepareUpgrade(
      proxyAddress,
      ContractFactory,
      deployOptions
    );

    console.log("Proxy:", proxyAddress);
    console.log("New Implementation:", contractImpl);

    const currentImpl = await upgrades.erc1967.getImplementationAddress(
      proxyAddress
    );

    if (contractImpl === currentImpl) {
      return;
    }

    await sleep(1000);
    await verify(contractImpl);

    if (useUUPS) {
      // Factory should be changed for the contract
      const contract = await connectContract(
        contractFactory,
        proxyAddress,
        deployer
      );
      await multisig(
        gnosisSafeServiceURL,
        contract,
        "upgradeTo",
        [contractImpl],
        JSON.stringify(upgradeProxyAbi),
        signer
      );
    } else {
      const proxyAdmin = (await upgrades.admin.getInstance()).address;
      const ProxyAdmin = ethers.ContractFactory.getContract(
        proxyAdmin,
        proxyAdminAbi,
        deployer
      );

      await multisig(
        gnosisSafeServiceURL,
        ProxyAdmin,
        "upgrade",
        [proxyAddress, contractImpl],
        JSON.stringify(proxyAdminAbi),
        signer
      );
    }
  } else {
    const proxy = await upgrades.upgradeProxy(
      proxyAddress,
      ContractFactory,
      deployOptions
    );
    await proxy.deployed();
  }
}
