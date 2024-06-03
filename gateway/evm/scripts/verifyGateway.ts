import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import fs from "fs";
const deployment = require("../deployment/deployments.json");

const deployments: IDeployment = deployment;
import _ from "lodash";
import { IDeployment, verify } from "./utils";

const gatewayConfig = require("./gatewayArgs.js");

//TODO: take inputs from task as params
task("verify:Gateway").setAction(async function (_taskArguments: TaskArguments, hre) {
    const network =  hre.hardhatArguments.network;
        if (network == undefined) {
            return;
        }
        await verify(hre,deployments[network]["GatewayUpgradeable"].proxy,true);
})

task("verify:AssetVault").setAction(async function (_taskArguments: TaskArguments, hre) {
    const network =  hre.hardhatArguments.network;
        if (network == undefined) {
            return;
        }
        await verify(hre,deployments[network]["GatewayUpgradeable"].assetVault,false,[deployments[network]["GatewayUpgradeable"].proxy,deployments[network]["GatewayUpgradeable"].routeToken]);
})

task("verify:routeToken").setAction(async function (_taskArguments: TaskArguments, hre) {
    const network =  hre.hardhatArguments.network;
        if (network == undefined) {
            return;
        }
        await verify(hre,deployments[network]["GatewayUpgradeable"].routeToken,false);
})

task("verify:valsetUpdate").setAction(async function (_taskArguments: TaskArguments, hre) {
    const network =  hre.hardhatArguments.network;
        if (network == undefined) {
            return;
        }
        await verify(hre,deployments[network]["GatewayUpgradeable"].valsetUpdate,false);
})
