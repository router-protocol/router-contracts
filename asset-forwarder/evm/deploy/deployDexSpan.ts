import { Provider, types, Wallet, ContractFactory, Contract } from "zksync-ethers";
import * as ethers from "ethers";
import * as fs from "fs-extra";
import * as path from "path";

import dotenv from "dotenv";
dotenv.config();

// yarn hardhat deploy-zksync --script deployDexSpan.ts
export async function deployDexSpan() {
    console.log(`Running deploy script for the DexSpan`);

    // console.log(hre.hardhatArguments.network);
    const provider = Provider.getDefaultProvider(types.Network.Mainnet);
    const ethProvider = ethers.getDefaultProvider("mainnet");

    const PRIVATE_KEY = process.env.USDC_PRIV_KEY || "";
    const wallet = new Wallet(PRIVATE_KEY, provider, ethProvider);

    const ASSET_FORWARDER = "0x8b6f1c18c866f37e6ea98aa539e0c117e70178a2";
    const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const WNATIVE = "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91";
    const SKIM = "0xB1b64005B11350a94c4D069eff4215592d98F2E2";
    const rpc = "https://mainnet.era.zksync.io";

    console.log({
        ASSET_FORWARDER,
        NATIVE,
        WNATIVE,
        SKIM,
        rpc
    });
    await new Promise((re, _) => {
        setTimeout(() => {
            re(true);
        }, 1000);
    });

    const DexSpanJsonString = await fs.readFile(
        path.join(__dirname, "../artifacts-zk/contracts/dexspan/DexSpan.sol/DexSpan.json"),
        "utf-8"
    );
    const DexSpanJson = JSON.parse(DexSpanJsonString);
    const contractAbi = DexSpanJson["abi"];;
    const contractByteCode = DexSpanJson["bytecode"];
    

    const factory = new ContractFactory(contractAbi, contractByteCode, wallet);
    const dexSpan = (await factory.deploy(ASSET_FORWARDER,
        NATIVE,
    WNATIVE,
    SKIM
    )) as Contract;
    console.log(`Contract address: ${await dexSpan.getAddress()}`);

}


deployDexSpan()