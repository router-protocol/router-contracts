import "@nomicfoundation/hardhat-toolbox";
import { resolve } from "path";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-deploy";
// import "@matterlabs/hardhat-zksync-upgradable";
import "@matterlabs/hardhat-zksync-verify";
import "@openzeppelin/hardhat-upgrades";

import { config as dotenvConfig } from "dotenv";
import { NetworkUserConfig } from "hardhat/types";

interface HardhatArguments {
  network?: string;
  valsetUpdate?: string;
}

const hardhatArguments: HardhatArguments = process.argv.reduce((acc, arg, index, array) => {
  if (arg.startsWith("--network")) {
    acc.network = array[index + 1];
  }
  if (arg.startsWith("--valset_update")) {
    acc.valsetUpdate = array[index + 1];
  }
  return acc;
}, {} as HardhatArguments);

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
  optimism: 10
};

// Ensure that we have all the environment variables we need.
const private_key = process.env.PRIVATE_KEY;
if (!private_key) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}

const infuraApiKey = process.env.INFURA_API_KEY;
if (!infuraApiKey) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
}

function getChainConfig(network: keyof typeof chainIds): NetworkUserConfig {
  let url = "";
  url = "https://" + network + ".infura.io/v3/" + infuraApiKey;
  if (network == "optimism") {
    url = "https://mainnet.optimism.io";
  }

  return {
    accounts: [`${process.env.PRIVATE_KEY}`],
    chainId: chainIds[network],
    url,
  };
}

const config = {
  defaultNetwork: "hardhat",

  gasReporter: {
    currency: "USD",
    enabled: true,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    optimism: getChainConfig("optimism"),
  },
  solidity: {
    version: "0.8.18",
    settings: {
      evmVersion: "landon",
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/solidity-template/issues/31
        bytecodeHash: "none",
      },
      // You should disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 999999,
      },
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  zksolc: {
    version: "1.4.0", // optional.
    settings: {
      // compilerPath: "zksolc", // optional. Ignored for compilerSource "docker". Can be used if compiler is located in a specific folder
      libraries: {}, // optional. References to non-inlinable libraries
      missingLibrariesPath: "./.zksolc-libraries-cache/missingLibraryDependencies.json", // optional. This path serves as a cache that stores all the libraries that are missing or have dependencies on other libraries. A `hardhat-zksync-deploy` plugin uses this cache later to compile and deploy the libraries, especially when the `deploy-zksync:libraries` task is executed
      isSystem: false, // optional.  Enables Yul instructions available only for zkSync system contracts and libraries
      forceEvmla: false, // optional. Falls back to EVM legacy assembly if there is a bug with Yul
      optimizer: {
        enabled: true, // optional. True by default
        mode: "3" // optional. 3 by default, z to optimize bytecode size
      },
      experimental: {
        dockerImage: "", // deprecated
        tag: "" // deprecated
      }
    }
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6"
  },

  etherscan: {
    apiKey: {
      optimisticEthereum: "D922B3PHZXNRX6DJIMQEB4MMNBI7KPW7RC"
    },
    sourcify: {
      // Disabled by default
      // Doesn't need an API key
      enabled: true
    },
    customChains: []
  },

};

export default config;
