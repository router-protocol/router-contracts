import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import fs from "fs";
import { recordAllDeployments } from "./utils";
import _ from "lodash";
import args from "../config/args.json";
import { validateInput } from "./validateInput";
const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

//TODO: take inputs from task as params
task("deploy:Gateway")
    .addOptionalParam("routetoken", "Address of Route Token")
    .addOptionalParam("env", "devnet,alpha or testnet")
    .setAction(async function (_taskArguments: TaskArguments, hre) {
        const network = hre.hardhatArguments.network;
        if (network == undefined) {
            return;
        }
        const chainId = hre.network.config.chainId;
        if (chainId == undefined) {
            return;
        }

        const valsetNonce = _taskArguments.valsetnonce ? _taskArguments.valsetnonce : args.valset.nonce;
        const validators = _taskArguments.validators
            ? _taskArguments.validators.split(",")
            : args.valset.members.map((member) => member.ethereumAddress);
        const powers = _taskArguments.powers
            ? _taskArguments.powers.split(",")
            : args.valset.members.map((member) => member.power);

        const [deployer] = await hre.ethers.getSigners();
        console.log("deployer.address ->", deployer.address);
        console.log("gatewayInitParams", chainId, validators, powers, valsetNonce);
        await validateInput();

        let routeToken = _taskArguments.routetoken;
        if (routeToken === "" || !routeToken) {
            console.log("Test Route Token Deployment Started");
            const TestRoute = await hre.ethers.getContractFactory("TestRoute");
            const testRoute = await TestRoute.deploy();
            await testRoute.waitForDeployment();
            routeToken = await testRoute.getAddress();
            console.log("Test Route Contract deployed to: ", routeToken);
        }

        const gatewayContract = "GatewayUpgradeable";
        console.log("Gateway Contract Deployment Started");
        const ValsetUpdate = await hre.ethers.getContractFactory("ValsetUpdate");
        console.log("Deploying ValsetUpdate library");
        const valsetUpdate = await ValsetUpdate.deploy(
            {
                // gasPrice: 1999627953,
                // gasLimit: 6000000
            }
        );
        await valsetUpdate.waitForDeployment();
        const valsetUpdateAddress = await valsetUpdate.getAddress();
        console.log("Deploying Contract, Using ValsetUpdate Lib address -> ", valsetUpdateAddress);
        const Gateway = await hre.ethers.getContractFactory(gatewayContract, {
            libraries: {
                ValsetUpdate: valsetUpdateAddress
            }
        });
        const gatewayProxy = await hre.upgrades.deployProxy(
            // @ts-ignore
            Gateway,
            [chainId.toString(), [...validators], [...powers], valsetNonce],
            {
                kind: "uups",
                unsafeAllowLinkedLibraries: true,
                txOverrides: {
                    gasLimit: 6000000
                }
            }
        );
        const txn = await gatewayProxy.waitForDeployment();
        const gatewayAddress = await gatewayProxy.getAddress();
        console.log(gatewayContract + " Proxy Contract deployed to: ", gatewayAddress);

        const deployTx = gatewayProxy.deploymentTransaction();
        console.log(deployTx?.blockNumber);
        console.log(gatewayAddress + "-" + deployTx?.blockNumber);
        const implementationAddr = await hre.upgrades.erc1967.getImplementationAddress(gatewayAddress);
        console.log(gatewayContract + " Implementation Contract deployed to: ", implementationAddr);
        const AssetVault = await hre.ethers.getContractFactory("AssetVault");
        const assetVault = await AssetVault.deploy("0x8eb6b8b335cbaf8c3d2edbaf8f3b8444637011b7", "0x5226d56F25DCDE6199791FC8793bea6803883bEb");
        await assetVault.waitForDeployment();
        const assetVaultAddress = await assetVault.getAddress();
        console.log("AssetVault Contract deployed to: ", assetVaultAddress);
        console.log("Contract Deployment Ended ");
        console.log("Deployment Storage Started ");
        const writeData = await recordAllDeployments(
            network,
            gatewayContract,
            gatewayAddress,
            implementationAddr,
            assetVaultAddress,
            valsetUpdateAddress,
            routeToken,
            deployTx?.blockNumber? deployTx?.blockNumber: 123
        );
        fs.writeFileSync("./deployment/deployments.json", JSON.stringify(writeData));
        console.log("Deployment Storage Ended ");

        console.log("Setting up vault address...");

        const tx = await gatewayProxy.setVault(assetVaultAddress);
        await tx.wait(4);

        console.log("Granting Route Minter role to AssetVault...");
        // const grantRoleTx = await testRoute.grantRole(MINTER_ROLE, assetVaultAddress);
        // await grantRoleTx.wait(4);
        console.log("Configuration completed...");

        if (gatewayAddress) {
            const implContract = await hre.upgrades.erc1967.getImplementationAddress(gatewayAddress);
            await hre.run("verify:verify", {
                address: implContract
            });
        }
        // DO NOT REMOVE this log, required for devops automation
        else console.log("");
    });
