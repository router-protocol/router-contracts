import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import fs from "fs";
import { ExtraTronWeb, IDeployment } from "./utils";
// const gatewayConfig = require("./gatewayArgs.js");
const deployment = require("../deployment/deployments.json");

const deployments: IDeployment = deployment;

task("upgrade:Gateway").setAction(async function (_taskArguments: TaskArguments, hre) {
    const network = await hre.hardhatArguments.network;
    if (network == undefined) {
        return;
    }
    console.log(network);
    const gatewayContract = "GatewayUpgradeable";
    const proxyAddr = deployments[network][gatewayContract].proxy;

    console.log("Contract Upgrade Started ");
    const Gateway = await hre.ethers.getContractFactory(gatewayContract, {
        libraries: {
            ValsetUpdate: deployments[network][gatewayContract].valsetUpdate
        }
    });

    // @ts-ignore
    const tx = await hre.upgrades.upgradeProxy(proxyAddr, Gateway, {
        unsafeAllow: ["external-library-linking"]
    });
    await tx.waitForDeployment();
    // console.log(tx);
    const implementationAddr = await hre.upgrades.erc1967.getImplementationAddress(proxyAddr);
    console.log(gatewayContract + "Proxy Contract: ", proxyAddr);
    console.log(gatewayContract + "Implementation Contract upgraded to: ", implementationAddr);
    console.log("Contract Deployment Ended ");

    console.log("Deployment Storage Started ");
    deployments[network][gatewayContract].implementation.push(implementationAddr);
    deployments[network][gatewayContract].updatedTime.push(Date.now());
    fs.writeFileSync("./deployment/deployments.json", JSON.stringify(deployments));
    console.log("Deployment Storage Ended ");
});

task("upgrade:GatewayTron")
    .addOptionalParam("net", "network")
    .setAction(async function (_taskArguments: TaskArguments, hre) {
        const network = await _taskArguments.net;
        if (network == undefined) {
            return;
        }
        const gatewayContract = "GatewayUpgradeable";
        const proxyAddr = deployments[network][gatewayContract].proxy;
        let updateValset = deployments[network][gatewayContract].valsetUpdate;
        const etronWeb = new ExtraTronWeb(network);
        const GatewayUpgradeableJson = require("../build/contracts/GatewayUpgradeable.json");
        const ValsetUpdateJson = require("../build/contracts/ValsetUpdate.json");

        if (!updateValset) {
            const valsetTxResponse = await (
                await etronWeb.deploy({
                    feeLimit: 1000000000,
                    userFeePercentage: 100,
                    abi: ValsetUpdateJson.abi,
                    bytecode: ValsetUpdateJson.bytecode,
                    name: "ValsetUpdate"
                })
            ).wait();
            console.log(
                "Valset Update: tx: ",
                valsetTxResponse.id,
                " and contract address: ",
                etronWeb.toHex(valsetTxResponse.contract_address)
            );
            updateValset = etronWeb.toHex(valsetTxResponse.contract_address);
        }
        const hextValsetAddress = etronWeb.tronWeb.address.toHex(updateValset).substr(2).toLowerCase();
        GatewayUpgradeableJson.bytecode = GatewayUpgradeableJson.bytecode.replace(
            /__ValsetUpdate__________________________/g,
            hextValsetAddress
        );
        const gatewayTxResponse = await etronWeb.upgrade(
            {
                feeLimit: 15000_000_000,
                callValue: 0,
                userFeePercentage: 100,
                abi: GatewayUpgradeableJson.abi,
                bytecode: GatewayUpgradeableJson.bytecode,
                name: "GatewayUpgradeable"
            },
            proxyAddr
        );
        console.log(
            "Gateway Contract: Proxy Contract:  ",
            gatewayTxResponse.proxy,
            ", Impl Address: ",
            gatewayTxResponse.impl
        );
    });
