import dotenv from "dotenv";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-foundry";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-upgradable";
dotenv.config();

const config = {
    defaultNetwork: "hardhat",
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 10000000
            }
        }
    },
    paths: {
        artifacts: "./artifacts/hardhat",
        cache: "./cache/hardhat"
    },
    networks: {
        hardhat: {
            gasMultiplier: 1.3,
            zksync: process.env.IS_ZKSYNC ? true : false
        },
        testnet: {
            url: process.env.TESTNET_RPC_URL || "",
            gasMultiplier: 1.3,
            zksync: process.env.IS_ZKSYNC ? true : false
        },
        mainnet: {
            url: process.env.MAINNET_RPC_URL || "",
            gasMultiplier: 1.3,
            zksync: process.env.IS_ZKSYNC ? true : false
        }
    },

    zksolc: {
        version: "1.4.0", // optional.
        settings: {
            // compilerPath: "zksolc", // optional. Ignored for compilerSource "docker". Can be used if compiler is located in a specific folder
            libraries: {
                "contracts/libraries/ValsetUpdate.sol": {
                    ValsetUpdate: process.env.ZK_SYNC_VALSET_UPDATE
                        ? process.env.ZK_SYNC_VALSET_UPDATE
                        : "0xc007A913EDA54ee02996F6685e5E24F4fe0FcE7E" //NOTE: Update While Compiling
                }
            },
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
        outDir: "./@types/generated",
        target: "ethers-v6",
        alwaysGenerateOverloads: false,
        externalArtifacts: ["build/contracts/**/*.json"],
        dontOverrideCompile: false
    },
    gasReporter: {
        enabled: process.env.ENABLE_GAS_REPORTER == "true"
    },
    contractSizer: {
        strict: true,
        except: ["contracts/test", "test/"]
    }
};

export default config;
