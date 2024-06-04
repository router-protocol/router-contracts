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
    console.log(deployer.ethWallet.address);
    const _dexSpan = "0x7E7D4185D9c3C44D5266eD974493b24811398049";
    const _gatewayAddress = "0x64a30c1114e77521dec751ea186da0b6bd10be71";
    const chainId = "router_9600-1";
    const routerBridgeAddress = "router17p9rzwnnfxcjp32un9ug7yhhzgtkhvl9jfksztgw5uh69wac2pgsmpev85";
    const startNonce = "0";

    const artifact = await deployer.loadArtifact("AssetBridge");
    const lib = await deployer.deploy(artifact, [_dexSpan, _gatewayAddress, chainId, routerBridgeAddress, startNonce]);

    const contractAddress = await lib.getAddress();
    console.log(`${artifact.contractName} was deployed to ${contractAddress}`);
}
