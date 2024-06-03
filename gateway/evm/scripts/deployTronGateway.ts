import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import fs from "fs";
import { ExtraTronWeb, recordAllDeployments } from "./utils";
import args from "../config/args.json";
const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

// npx hardhat deploy:TronGateway --net shasta
task("deploy:TronGateway")
    .addOptionalParam("net", "network")
    .addOptionalParam("routetoken", "Address of Route Token")
    .setAction(async function (_taskArguments: TaskArguments, hre) {
        // let routeToken = _taskArguments.routetoken;
        let network = _taskArguments.net;
        if (!network) network = "shasta";
        network = network.toLowerCase();

        const valsetNonce = _taskArguments.valsetnonce ? _taskArguments.valsetnonce : args.valset.nonce;
        const validators = _taskArguments.validators
            ? _taskArguments.validators.split(",")
            : args.valset.members.map((member) => member.ethereumAddress);
        const powers = _taskArguments.powers
            ? _taskArguments.powers.split(",")
            : args.valset.members.map((member) => member.power);

        const etronWeb = new ExtraTronWeb(network);

        const GatewayUpgradeableJson = require("../build/contracts/GatewayUpgradeable.json");
        const ValsetUpdateJson = require("../build/contracts/ValsetUpdate.json");
        const TestRouteJson = require("../build/contracts/TestRoute.json");
        const AssestVaultJson = require("../build/contracts/AssetVault.json");

        // if (routeToken === "" || !routeToken) {
        //     console.log("Test Route Token Deployment Started");
        //     const testRoute = await (
        //         await etronWeb.deploy({
        //             feeLimit: 15000_000_000,
        //             userFeePercentage: 100,
        //             abi: TestRouteJson.abi,
        //             bytecode: TestRouteJson.bytecode,
        //             name: "TestRoute"
        //         })
        //     ).wait();
        //     routeToken = etronWeb.toHex(testRoute.contract_address);
        //     console.log("Test Route Contract deployed to: ", routeToken);
        // }

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
        const hextValsetAddress = etronWeb.tronWeb.address
            .toHex(valsetTxResponse.contract_address)
            .substr(2)
            .toLowerCase();
        GatewayUpgradeableJson.bytecode = GatewayUpgradeableJson.bytecode.replace(
            /__ValsetUpdate__________________________/g,
            hextValsetAddress
        );

        console.log(
            "gatewayInitParams: ",
            network,
            validators.map((v: string) => etronWeb.toHex(v)),
            powers,
            valsetNonce
        );

        const gatewayTxResponse = await etronWeb.deployProxy(
            {
                feeLimit: 15000_000_000,
                callValue: 0,
                userFeePercentage: 100,
                abi: GatewayUpgradeableJson.abi,
                bytecode: GatewayUpgradeableJson.bytecode,
                name: "GatewayUpgradeable"
            },
            [etronWeb.chainId, validators.map((v: string) => etronWeb.toHex(v)), powers, valsetNonce]
        );

        console.log(
            "Gateway Contract: Proxy Contract:  ",
            gatewayTxResponse.proxy,
            ", Impl Address: ",
            gatewayTxResponse.impl
        );

        //deploy assetVault
        // console.log("Deploying AssetVault...");
        // const assetVaultResponse = await etronWeb.deployWithParams(
        //     {
        //         abi: AssestVaultJson.abi,
        //         bytecode: AssestVaultJson.bytecode,
        //         feeLimit: 1000000000,
        //         callValue: 0,
        //         userFeePercentage: 100,
        //         originEnergyLimit: 10000000,
        //         name: "AssestVault"
        //     },
        //     [etronWeb.fromHex(gatewayTxResponse.proxy), etronWeb.fromHex(routeToken)]
        // );
        // console.log("AssetVault Contract - contract address: ", etronWeb.toHex(assetVaultResponse.address));

        console.log("Deployment Storage Started ");
        const writeData = await recordAllDeployments(
            network,
            "GatewayUpgradeable",
            etronWeb.toHex(gatewayTxResponse.proxy),
            etronWeb.toHex(gatewayTxResponse.impl),
            "etronWeb.toHex(assetVaultResponse.address)",
            etronWeb.toHex(valsetTxResponse.contract_address),
            "etronWeb.toHex(routeToken)",
            gatewayTxResponse.blockNumber
        );
        fs.writeFileSync("./deployment/deployments.json", JSON.stringify(writeData));
        console.log("Deployment Storage Ended ");

        // const gatewayInstance = etronWeb.tronWeb.contract(
        //     GatewayUpgradeableJson.abi,
        //     etronWeb.fromHex(gatewayTxResponse.proxy)
        // );
        // const setVaultTxHash = await (
        //     await gatewayInstance.setVault(etronWeb.fromHex(assetVaultResponse.address))
        // ).send();
        // console.log("Gateway -  SetVault: txhash: ", setVaultTxHash);

        // const testRouteInstance = etronWeb.tronWeb.contract(TestRouteJson.abi, etronWeb.fromHex(routeToken));
        // const grantMintingRoleTxHash = await (
        //     await testRouteInstance.grantRole(MINTER_ROLE, etronWeb.fromHex(assetVaultResponse.address))
        // ).send();
        // console.log("TestRoute - GrantRole: txhash: ", grantMintingRoleTxHash);
    });
