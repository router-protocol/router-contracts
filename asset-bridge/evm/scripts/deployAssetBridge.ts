import * as fs from "fs-extra";
import * as path from "path";
// import { ethers } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import dotenv from "dotenv";
dotenv.config();

async function deployContract() {
    const assetBridgeJSON =
        JSON.parse(fs.readFileSync("./artifacts/contracts/AssetBridge.sol/AssetBridge.json", "utf-8"));
    const assetBridgeABI = assetBridgeJSON.abi;

    const AssetForwarderBytecode = assetBridgeJSON.bytecode;

    console.log("Asset Forwarder Deployment Started");
    
    const rpc = "https://ethereum-holesky.publicnode.com";
    
    const provider = new ethers.JsonRpcProvider(rpc);
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("Please set your PRIVATE_KEY in the .env file");
    }
    const signer = new ethers.Wallet(
        privateKey,
        provider
    );
    
    const Contract = new ethers.ContractFactory(
        assetBridgeABI,
        AssetForwarderBytecode,
        signer
    );

    const _dexSpan = "0x0000000000000000000000000000000000000000";
    const _gatewayAddress = "0xac58258eCFAA60Da89cd34983cAFD529f39072b1";
    const chainId = "router_9601-1";
    const routerBridgeAddress = "router17p9rzwnnfxcjp32un9ug7yhhzgtkhvl9jfksztgw5uh69wac2pgsmpev85";
    const startNonce = "0";

    const deployer = signer.address;
    console.log("constrcutor Args", _dexSpan, _gatewayAddress, chainId, routerBridgeAddress, startNonce);
    console.log("Deployment Info", deployer, rpc);
    const contract = await Contract.deploy(
        _dexSpan,
        _gatewayAddress,
        chainId,
        routerBridgeAddress,
        startNonce
    );
    await contract.waitForDeployment();
    const assetForwarderAddress = await contract.getAddress();
    console.log("Contract deployed to: ", assetForwarderAddress);
}

async function deployUpgradeableContract() {
    // const assetBridgeJSON =
    //     JSON.parse(fs.readFileSync("./artifacts/contracts/AssetBridgeUpgradeable.sol/AssetBridgeUpgradeable.json", "utf-8"));
    // const assetBridgeABI = assetBridgeJSON.abi;

    // const AssetForwarderBytecode = assetBridgeJSON.bytecode;

    console.log("Asset Forwarder Deployment Started");
    const Contract = await ethers.getContractFactory("AssetBridgeUpgradeable");
    // (
    //     assetBridgeABI,
    //     AssetForwarderBytecode,
    //     signer
    // );

    const _dexSpan = "0x0000000000000000000000000000000000000000";
    const _gatewayAddress = "0x86DFc31d9cB3280eE1eB1096caa9fC66299Af973";
    const chainId = "router_9600-1";
    const routerBridgeAddress = "router17p9rzwnnfxcjp32un9ug7yhhzgtkhvl9jfksztgw5uh69wac2pgsmpev85";
    const startNonce = "0";

    console.log("constrcutor Args", _dexSpan, _gatewayAddress, chainId, routerBridgeAddress, startNonce);
    const contract = await upgrades.deployProxy(
        Contract,
        [_dexSpan, _gatewayAddress, chainId, routerBridgeAddress, startNonce],
        {
            kind: "uups",
            unsafeAllowLinkedLibraries: true,
            txOverrides: { 
                gasPrice: 0,
                gasLimit: 5700000 
            }
        }
    );
    // await contract.deployed();
    await contract.waitForDeployment();
    const assetForwarderAddress = await contract.getAddress();
    console.log("Contract deployed to: ", assetForwarderAddress);
}

// deployContract()
//     .then(() => { })
//     .catch(console.log);

deployUpgradeableContract()
    .then(() => { })
     .catch(console.log);
