import chai, { assert, expect } from "chai";
import { Contract, utils } from "ethers";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { defaultAbiCoder } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);

const CHAIN_ID = "1";
const POWERS = [1431655765, 1431655765, 1431655765];
const FEE = "123";
const EXP_TIMESTAMP = 1752503506;
const VALSET_NONCE: number = 0;
const ROUTER_BRIDGE_ADDRESS = "router10emt4hxmeyr8mjxayyt8huelzd7fpntmly8vus5puelqde6kn8xqcqa30g";
const RELAYER_ROUTER_ADDRESS = "router1hrpna9v7vs3stzyd4z3xf00676kf78zpe2u5ksvljswn2vnjp3ys8kpdc7";
const amount = "1000000000000000000000";
const recipient = "0xdE23C5FfC7B045b48F0B85ADA2c518d213d9e24F";
const I_RECEIVE_BYTES = "0x6952656365697665000000000000000000000000000000000000000000000000";
const TIMESTAMP = 1752503506;

describe("Multi Validator Test-Cases", function () {
    let vault: Contract;
    let testRoute: Contract;
    let gateway: Contract;
    let signers: SignerWithAddress[];
    let VALIDATORS: string[];

    beforeEach(async () => {
        const TestRoute = await ethers.getContractFactory("TestRoute");
        testRoute = await TestRoute.deploy();

        const ValsetUpdate = await ethers.getContractFactory("ValsetUpdate");
        let valsetUpdate = await ValsetUpdate.deploy();

        signers = await ethers.getSigners();
        VALIDATORS = [signers[0].address, signers[1].address, signers[2].address];
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

    it("Should handle Multiple validators", async function () {
        await gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);

        const OutBoundCase = await ethers.getContractFactory("OutBoundCase");
        const outBoundCase = await OutBoundCase.deploy(gateway.address);
        await gateway.setVault(vault.address);
        expect(await outBoundCase.gatewayContract()).to.be.equals(gateway.address);

        let _currentValset = {
            validators: VALIDATORS,
            powers: POWERS,
            valsetNonce: VALSET_NONCE
        };
        const handlerBytes = outBoundCase.address;

        let greeting = "Hello Route";
        const truePayload = defaultAbiCoder.encode(["string"], [greeting]);
        const requestSender = "0x00000000000000000000";
        const asmAddress = recipient;
        const requestIdentifier = 12;

        let encoded_data = utils.defaultAbiCoder.encode(
            [
                "bytes32",
                "uint256",
                "uint256",
                "uint256",
                "string",
                "address",
                "string",
                "address",
                "string",
                "address",
                "bytes",
                "bool"
            ],
            [
                I_RECEIVE_BYTES,
                amount,
                requestIdentifier,
                TIMESTAMP,
                CHAIN_ID,
                recipient,
                CHAIN_ID,
                asmAddress,
                requestSender,
                handlerBytes,
                truePayload,
                false
            ]
        );
        const testBytes = utils.arrayify(encoded_data);
        const messageHash = utils.keccak256(testBytes);

        const messageHashBytes = utils.arrayify(messageHash);

        let sign0 = await signers[0].signMessage(messageHashBytes);
        // let signature0 = utils.splitSignature(sign0);

        let sign1 = await signers[1].signMessage(messageHashBytes);
        // let signature1 = utils.splitSignature(sign1);

        let sign2 = await signers[2].signMessage(messageHashBytes);
        // let signature2 = utils.splitSignature(sign2);
        // console.log(`Signature 0: r=${signature0.r}, s=${signature0.s}, v=${signature0.v}`);
        // console.log(`Signature 1: r=${signature1.r}, s=${signature1.s}, v=${signature1.v}`);
        // console.log(`Signature 2: r=${signature2.r}, s=${signature2.s}, v=${signature2.v}`);

        let _sigs = [sign0, sign1, sign2];

        let currentNonce = parseInt(await gateway.eventNonce()) + 1;
        let requestPayload = {
            routeAmount: amount,
            requestIdentifier: requestIdentifier,
            requestTimestamp: TIMESTAMP,
            srcChainId: CHAIN_ID,
            routeRecipient: recipient,
            destChainId: CHAIN_ID,
            asmAddress: asmAddress,
            requestSender: requestSender,
            handlerAddress: handlerBytes,
            packet: truePayload,
            isReadCall: false
        };

        let execData = utils.defaultAbiCoder.encode(["string"], [greeting]);
        let execData1 = utils.defaultAbiCoder.encode(["bytes"], [execData]);
        expect(await gateway.eventNonce()).to.be.equal(1);
        await expect(gateway.iReceive(_currentValset, _sigs, requestPayload, RELAYER_ROUTER_ADDRESS))
            .to.emit(gateway, "IReceiveEvent")
            .withArgs(
                requestIdentifier,
                currentNonce,
                CHAIN_ID,
                CHAIN_ID,
                RELAYER_ROUTER_ADDRESS,
                requestSender,
                execData1,
                true
            );

        console.log("Test Executed");

        expect(outBoundCase.greeting(), greeting);
    });

    it("Should handle if validator powers meet 2/3+1 consensus", async function () {
        const POWERS1 = [50000, 2147483647, 2147483648];
        await gateway.initialize(CHAIN_ID, VALIDATORS, POWERS1, VALSET_NONCE);

        const OutBoundCase = await ethers.getContractFactory("OutBoundCase");
        const outBoundCase = await OutBoundCase.deploy(gateway.address);
        await gateway.setVault(vault.address);
        expect(await outBoundCase.gatewayContract()).to.be.equals(gateway.address);

        let _currentValset = {
            validators: VALIDATORS,
            powers: POWERS1,
            valsetNonce: VALSET_NONCE
        };
        const handlerBytes = outBoundCase.address;

        let greeting = "Hello Route";
        const truePayload = defaultAbiCoder.encode(["string"], [greeting]);
        const requestSender = "0x00000000000000000000";
        const asmAddress = recipient;
        const requestIdentifier = 12;

        let encoded_data = utils.defaultAbiCoder.encode(
            [
                "bytes32",
                "uint256",
                "uint256",
                "uint256",
                "string",
                "address",
                "string",
                "address",
                "string",
                "address",
                "bytes",
                "bool"
            ],
            [
                I_RECEIVE_BYTES,
                amount,
                requestIdentifier,
                TIMESTAMP,
                CHAIN_ID,
                recipient,
                CHAIN_ID,
                asmAddress,
                requestSender,
                handlerBytes,
                truePayload,
                false
            ]
        );
        const testBytes = utils.arrayify(encoded_data);
        const messageHash = utils.keccak256(testBytes);

        const messageHashBytes = utils.arrayify(messageHash);

        let sign0 =
            "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        // let signature0 = utils.splitSignature(sign0);

        let sign1 = await signers[1].signMessage(messageHashBytes);
        // let signature1 = utils.splitSignature(sign1);

        let sign2 = await signers[2].signMessage(messageHashBytes);
        // let signature2 = utils.splitSignature(sign2);
        // console.log(`Signature 0: r=${signature0.r}, s=${signature0.s}, v=${signature0.v}`);
        // console.log(`Signature 1: r=${signature1.r}, s=${signature1.s}, v=${signature1.v}`);
        // console.log(`Signature 2: r=${signature2.r}, s=${signature2.s}, v=${signature2.v}`);

        let _sigs = [sign0, sign1, sign2];

        let currentNonce = parseInt(await gateway.eventNonce()) + 1;
        let requestPayload = {
            routeAmount: amount,
            requestIdentifier: requestIdentifier,
            requestTimestamp: TIMESTAMP,
            srcChainId: CHAIN_ID,
            routeRecipient: recipient,
            destChainId: CHAIN_ID,
            asmAddress: asmAddress,
            requestSender: requestSender,
            handlerAddress: handlerBytes,
            packet: truePayload,
            isReadCall: false
        };

        let execData = utils.defaultAbiCoder.encode(["string"], [greeting]);
        let execData1 = utils.defaultAbiCoder.encode(["bytes"], [execData]);
        expect(await gateway.eventNonce()).to.be.equal(1);
        await expect(gateway.iReceive(_currentValset, _sigs, requestPayload, RELAYER_ROUTER_ADDRESS))
            .to.emit(gateway, "IReceiveEvent")
            .withArgs(
                requestIdentifier,
                currentNonce,
                CHAIN_ID,
                CHAIN_ID,
                RELAYER_ROUTER_ADDRESS,
                requestSender,
                execData1,
                true
            );

        console.log("Test Executed");

        expect(outBoundCase.greeting(), greeting);
    });
});
