import { Provider, types, Wallet, ContractFactory, Contract } from "zksync-ethers";
import * as ethers from "ethers";
import * as fs from "fs-extra";
import * as path from "path";

import dotenv from "dotenv";
dotenv.config();

// npx ts-node deploy/deployzkSyncAF.ts
export async function deployAssetForwarder() {
    console.log(`Running deploy script for the Gateway Lib`);

    // console.log(hre.hardhatArguments.network);
    const provider = Provider.getDefaultProvider(types.Network.Mainnet);
    const ethProvider = ethers.getDefaultProvider("mainnet");

    const PRIVATE_KEY = process.env.USDC_PRIV_KEY || "";
    const wallet = new Wallet(PRIVATE_KEY, provider, ethProvider);

    const _wrappedNativeTokenAddress = "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91";
    const _gatewayContract = "0x64a30c1114e77521dec751ea186da0b6bd10be71";
    const _usdcAddress = "0x0000000000000000000000000000000000000000";
    const _tokenMessenger = "0x0000000000000000000000000000000000000000";
    const _routerMiddlewareBase = "0x726F757465723134686A32746176713866706573647778786375343472747933686839307668756A7276636D73746C347A723374786D667677397330307A74766B";
    const _minGasThreshhold = 100000;

    console.log({
        _wrappedNativeTokenAddress,
        _gatewayContract,
        _usdcAddress,
        _tokenMessenger,
        _routerMiddlewareBase,
        _minGasThreshhold
    });
    await new Promise((re, _) => {
        setTimeout(() => {
            re(true);
        }, 5000);
    });
    // const deployer = new Deployer(hre, wallet);

    const AssetForwarderJsonString = await fs.readFile(
        path.join(__dirname, "../artifacts-zk/contracts/AssetForwarder.sol/AssetForwarder.json"),
        "utf-8"
    );
    const AssetForwarderJson = JSON.parse(AssetForwarderJsonString);
    const contractAbi = AssetForwarderJson["abi"];;
    const contractByteCode = AssetForwarderJson["bytecode"];
    
    const factory = new ContractFactory(contractAbi, contractByteCode, wallet);
    const assetForwarder = (await factory.deploy(_wrappedNativeTokenAddress,
        _gatewayContract,
        _usdcAddress,
        _tokenMessenger,
        _routerMiddlewareBase,
        _minGasThreshhold)) as Contract;
    console.log(`Contract address: ${await assetForwarder.getAddress()}`);

}

export async function deployErc20Token() {
    console.log(`Deploying ERC20 Token`);

    // console.log(hre.hardhatArguments.network);
    const provider = Provider.getDefaultProvider(types.Network.Sepolia);
    const ethProvider = ethers.getDefaultProvider("sepolia");

    const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
    const wallet = new Wallet(PRIVATE_KEY, provider, ethProvider);

    const contractJsonString = await fs.readFile(
        path.join(__dirname, "../artifacts-zk/contracts/ERC20Token.sol/ERC20Token.json"),
        "utf-8"
    );
    const contractJson = JSON.parse(contractJsonString);
    const contractAbi = contractJson["abi"];;
    const contractByteCode = contractJson["bytecode"];
    const tokenName = "USDT";
    const tokenSymbol = "USDT";
    const tokenDecimal = 6;
    const totalSupply = 1000000;

    const factory = new ContractFactory(contractAbi, contractByteCode, wallet);
    const assetForwarder = (await factory.deploy(
        tokenName,
        tokenSymbol,
        tokenDecimal,
        totalSupply)) as Contract;
    console.log(`Contract address: ${await assetForwarder.getAddress()}`);

}


deployAssetForwarder()