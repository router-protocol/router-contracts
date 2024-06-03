import { Provider, types, Wallet, ContractFactory, Contract } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

import dotenv from "dotenv";
dotenv.config();
import args from "../config/args.json";
const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

// yarn hardhat deploy-zksync --script deployzkSyncGateway.ts
export default async function (hre: HardhatRuntimeEnvironment) {
    console.log(`Running deploy script for the Gateway Lib`);
    const network = hre.network;
    if (network == undefined) {
        return;
    }
    const chainId = "280" || network.config.chainId;
    if (chainId == undefined) {
        return;
    }

    // Just to notify
    console.log(
        "Have You Update Valset Update Library Address in Hardhat Config at zksolc.settings.libraries, Think For 5 Sec Before Going Ahead!!"
    );
    await new Promise((re, _) => {
        setTimeout(() => {
            re(true);
        }, 5000);
    });

    const valsetNonce = args.valset.nonce;
    const validators = args.valset.members.map((member) => member.ethereumAddress);
    const powers = args.valset.members.map((member) => member.power);

    console.log({
        chainId: chainId.toString(),
        validators,
        powers,
        valsetNonce
    });
    const wallet = new Wallet(process.env.PRIVATE_KEY!);

    //@ts-ignore
    const deployer = new Deployer(hre, wallet);
    const routeArtifact = await deployer.loadArtifact("TestRoute");
    const routeInstace = await deployer.deploy(routeArtifact, []);
    const routeAddress = await routeInstace.getAddress();
    console.log(`TestRoute was deployed to ${routeAddress}`);
    console.log();

    const artifact = await deployer.loadArtifact("GatewayUpgradeable");

    const gatewayInstance = await hre.zkUpgrades.deployProxy(
        deployer.zkWallet,
        artifact,
        [chainId.toString(), validators, powers, valsetNonce],
        {
            initializer: "initialize",
            kind: "uups"
        }
    );
    const gatewayAddress = await gatewayInstance.getAddress();
    console.log(`${artifact.contractName} was deployed to ${gatewayAddress}`);

    const assetVaultArtifact = await deployer.loadArtifact("AssetVault");
    const assetVaultInstance = await deployer.deploy(assetVaultArtifact, [gatewayAddress, routeAddress]);
    const assetVaultAddress = await assetVaultInstance.getAddress();
    console.log(`AssetVaultInstance was deployed to ${assetVaultAddress}`);
    console.log();

    const vevents = gatewayInstance.filters.ValsetUpdatedEvent();
    console.log(await gatewayInstance.queryFilter(vevents, 14894635, 14894645));

    const tx = await gatewayInstance.setVault(assetVaultAddress);
    await tx.wait(4);

    console.log("Granting Route Minter role to AssetVault...");
    const TestRoute = await hre.ethers.getContractFactory("TestRoute");
    //@ts-ignore
    const testRoute = TestRoute.attach(routeAddress).connect(wallet.connect(hre.network.provider));
    // @ts-ignore
    const grantRoleTx = await testRoute.grantRole(MINTER_ROLE, assetVaultAddress);

    console.log(grantRoleTx);
}
