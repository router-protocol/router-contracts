import { expect } from "chai";
import { Contract, SigningKey } from "ethers";
import { ethers } from "hardhat";
import { defaultAbiCoder } from "@ethersproject/abi";

const CHAIN_ID: string = "1";
const POWERS = [4294967295];
const VALSET_NONCE: number = 1;
const I_ACK_BYTES = "0x6941636b00000000000000000000000000000000000000000000000000000000";
const RELAYER_ROUTER_ADDRESS = "router1hrpna9v7vs3stzyd4z3xf00676kf78zpe2u5ksvljswn2vnjp3ys8kpdc7";
const amount = "100000";

describe("Gateway Ack Request Testing", function () {
    let testRoute: Contract;
    let valsetUpdate: Contract;
    let vault: Contract;
    let gateway: Contract;
    let signers: SigningKey[];
    let VALIDATORS: string[];

    beforeEach(async () => {
        const TestRoute = await ethers.getContractFactory("TestRoute");
        testRoute = await TestRoute.deploy();

        const ValsetUpdate = await ethers.getContractFactory("ValsetUpdate");
        valsetUpdate = await ValsetUpdate.deploy();

        signers = await ethers.SigningKey();
        VALIDATORS = [signers[0].address];
        const Gateway = await ethers.getContractFactory("GatewayUpgradeable", {
            libraries: {
                ValsetUpdate: valsetUpdate.address
            }
        });
        gateway = await Gateway.deploy();
        const Vault = await ethers.getContractFactory("AssetVault");
        vault = await Vault.deploy(gateway.address, testRoute.address);

        await testRoute.mint(signers[0].address, amount);
        await testRoute.approve(vault.address, amount);
        await testRoute.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", vault.address);
        await testRoute.grantRole("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", vault.address);
    });

    it("Should call iAck", async function () {
        gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
        const HelloWorld = await ethers.getContractFactory("HelloWorld");
        const helloWorld = await HelloWorld.deploy(gateway.address, testRoute.address, vault.address);

        expect(await helloWorld.gatewayContract()).to.be.equals(gateway.address);

        await gateway.setVault(vault.address);
        let _currentValset = {
            validators: VALIDATORS,
            powers: POWERS,
            valsetNonce: VALSET_NONCE
        };
        const requestIdentifier = 12;
        const requestSender = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
        let execData = "0x";
        const execFlag = false;
        let encoded_data = utils.defaultAbiCoder.encode(
            ["bytes32", "string", "uint256", "uint256", "string", "address", "bytes", "bool"],
            [I_ACK_BYTES, CHAIN_ID, requestIdentifier, requestIdentifier, CHAIN_ID, requestSender, execData, execFlag]
        );
        const testBytes = utils.arrayify(encoded_data);
        const messageHash = utils.keccak256(testBytes);

        const messageHashBytes = utils.arrayify(messageHash);

        let sign = await signers[0].signMessage(messageHashBytes);

        let _sigs = [sign];
        let requestPayload = {
            requestIdentifier: requestIdentifier,
            ackRequestIdentifier: requestIdentifier,
            destChainId: CHAIN_ID,
            requestSender: requestSender,
            execData: execData,
            execFlag: execFlag
        };

        let data = "0x";

        await expect(gateway.iAck(_currentValset, _sigs, requestPayload, RELAYER_ROUTER_ADDRESS))
            .to.emit(gateway, "IAckEvent")
            .withArgs(2, requestPayload.requestIdentifier, RELAYER_ROUTER_ADDRESS, CHAIN_ID, data, true);

        await expect(gateway.iAck(_currentValset, _sigs, requestPayload, RELAYER_ROUTER_ADDRESS)).to.be.revertedWith(
            "C06"
        );
    });
});
