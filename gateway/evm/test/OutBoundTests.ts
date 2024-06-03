import chai, { assert, expect } from "chai";
import { Contract, utils } from "ethers";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { defaultAbiCoder } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { recoverPublicKey } from "ethers/lib/utils";

chai.use(solidity);

const CHAIN_ID = "1";
const CHAIN_TYPE = "1";
const POWERS = [4294967295];
const FEE = "123";
const EXP_TIMESTAMP = 1752503506;
const VALSET_NONCE: number = 0;
const ROUTER_BRIDGE_ADDRESS = "router10emt4hxmeyr8mjxayyt8huelzd7fpntmly8vus5puelqde6kn8xqcqa30g";
const RELAYER_ROUTER_ADDRESS = "router1hrpna9v7vs3stzyd4z3xf00676kf78zpe2u5ksvljswn2vnjp3ys8kpdc7";
const amount = "1000000000000000000000";
const recipient = "0xdE23C5FfC7B045b48F0B85ADA2c518d213d9e24F";
const I_RECEIVE_BYTES = "0x6952656365697665000000000000000000000000000000000000000000000000";
const TIMESTAMP = 1752503506;

describe("Out Bound Test Cases", function () {
    let gateway: Contract;
    let vault: Contract;
    let testRoute: Contract;
    let signers: SignerWithAddress[];
    let VALIDATORS: string[];

    beforeEach(async () => {
        const ValsetUpdate = await ethers.getContractFactory("ValsetUpdate");
        let valsetUpdate = await ValsetUpdate.deploy();

        signers = await ethers.getSigners();
        VALIDATORS = [signers[0].address];
        const Gateway = await ethers.getContractFactory("GatewayUpgradeable", {
            libraries: {
                ValsetUpdate: valsetUpdate.address
            }
        });
        gateway = await Gateway.deploy();

        const TestRoute = await ethers.getContractFactory("TestRoute");
        testRoute = await TestRoute.deploy();

        const Vault = await ethers.getContractFactory("AssetVault");
        vault = await Vault.deploy(gateway.address, testRoute.address);

        await testRoute.mint(signers[0].address, amount);
        await testRoute.approve(vault.address, amount);
        await testRoute.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", vault.address);
        await testRoute.grantRole("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", vault.address);
    });

    it("Should handle Multiple Request from Router while isAtomic is false", async function () {
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

    it("Should handle Multiple Request from Router while isAtomic is true", async function () {
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

        const falsePayload = defaultAbiCoder.encode(["string"], [""]);
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
                falsePayload,
                false
            ]
        );
        const testBytes = utils.arrayify(encoded_data);
        const messageHash = utils.keccak256(testBytes);

        const messageHashBytes = utils.arrayify(messageHash);

        let sign = await signers[0].signMessage(messageHashBytes);
        // let signature1 = utils.splitSignature(sign);

        let _sigs = [sign];

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
            packet: falsePayload,
            isReadCall: false
        };

        let errorData =
            "0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001f706c656173652070726f76696465206e6f6e2d656d70747920737472696e6700";
        // let execData1 = utils.defaultAbiCoder.encode(["bytes"], [execData]);
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
                errorData,
                false
            );

        expect(outBoundCase.greeting(), "");
    });

    // it("Should call Request to Router from OutBound", async function () {
    //     await gateway.initialize("80001", VALIDATORS, POWERS, VALSET_NONCE);
    //     await gateway.setVault(vault.address);
    //     const OutBoundCase = await ethers.getContractFactory("OutBoundCase");
    //     const outBoundCase = await OutBoundCase.deploy(gateway.address);

    //     let chainType = 0;
    //     let chainId = "7545";
    //     let str = "Hello Router";
    //     let destinationContractAddress = "0x12967d76a67FdE3a1987B971a91cF4Fc6db14A3d";
    //     let innerPaylaod = defaultAbiCoder.encode(
    //         ["uint64", "string", "string", "address"],
    //         [chainType, chainId, str, destinationContractAddress]
    //     );
    //     let payload = defaultAbiCoder.encode(["uint64", "bytes"], [2, innerPaylaod]);

    //     await expect(
    //         await outBoundCase.sendRequestToRouter(
    //             chainType,
    //             chainId,
    //             destinationContractAddress,
    //             str,
    //             ROUTER_BRIDGE_ADDRESS
    //         )
    //     )
    //         .to.be.emit(gateway, "RequestToRouterEvent")
    //         .withArgs(
    //             [0, "", 2, 0, "80001"],
    //             outBoundCase.address.toLowerCase(),
    //             ROUTER_BRIDGE_ADDRESS,
    //             0,
    //             signers[0].address,
    //             payload,
    //             "0x3078"
    //         );

    //     expect(await gateway.eventNonce()).to.be.equal(2);

    //     let first_decode = defaultAbiCoder.decode(["uint64", "bytes"], payload);
    //     assert.equal(first_decode[0], 2);
    //     assert.equal(first_decode[1], innerPaylaod);
    //     let data = defaultAbiCoder.decode(["uint64", "string", "string", "address"], innerPaylaod);
    //     assert.equal(data[0], 0);
    //     assert.equal(data[1], chainId);
    //     assert.equal(data[2], str);
    //     assert.equal(data[3], destinationContractAddress);
    // });
});
