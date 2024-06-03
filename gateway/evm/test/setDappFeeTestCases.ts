import chai, { expect } from "chai";
import { Contract } from "ethers";
// import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { GatewayUpgradeable__factory } from "../typechain";
import { ethers } from "hardhat";

chai.use(solidity);

const CHAIN_ID: string = "1";
const DEST_CHAIN_ID: string = "2";
const CHAIN_TYPE: number = 1;
const POWERS = [4294967295];
const VALSET_NONCE: number = 1;
const ROUTER_BRIDGE_ADDRESS = "router10emt4hxmeyr8mjxayyt8huelzd7fpntmly8vus5puelqde6kn8xqcqa30g";

describe("Register Dapp Testing", function () {
    let Gateway: GatewayUpgradeable__factory;
    let gateway: Contract;
    let signers: HardhatEthersSigner[];
    let valsetUpdate: Contract;
    let VALIDATORS: string[];

    beforeEach(async () => {
        const ValsetUpdate = await ethers.deplo("ValsetUpdate");
        valsetUpdate = await ValsetUpdate.deploy();

        signers = await ethers.getSigners();
        VALIDATORS = [signers[0].address];
        const Gateway = await ethers.getContractFactory("GatewayUpgradeable", {
            libraries: {
                ValsetUpdate: valsetUpdate.address
            }
        });

        it("Should call Request To Destination Chain", async function () {
            await gateway.initialize(CHAIN_ID, CHAIN_TYPE, VALIDATORS, POWERS, VALSET_NONCE);

            const feePayerAddress = ROUTER_BRIDGE_ADDRESS;

            await expect(gateway.setDappMetadata(ROUTER_BRIDGE_ADDRESS))
                .to.emit(gateway, "SetDappMetadataEvent")
                .withArgs(2, signers[0].address.toLowerCase(), CHAIN_ID, CHAIN_TYPE, feePayerAddress);
        });
    });
});
