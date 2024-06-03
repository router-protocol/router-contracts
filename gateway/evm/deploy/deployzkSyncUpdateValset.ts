import { Provider, types, Wallet, ContractFactory, Contract } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// load env file
import dotenv from "dotenv";
dotenv.config();
// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
if (!PRIVATE_KEY) throw "⛔️ Private key not detected! Add it to the .env file!";

// yarn hardhat deploy-zksync --script deployzkSyncUpdateValset.ts
export default async function (hre: HardhatRuntimeEnvironment) {
    console.log(`Running deploy script for the Valset Update Lib`);
    const wallet = new Wallet(PRIVATE_KEY);
    // @ts-ignore
    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact("ValsetUpdate");
    const lib = await deployer.deploy(artifact, []);

    const contractAddress = await lib.getAddress();
    console.log(`${artifact.contractName} was deployed to ${contractAddress}`);
}
