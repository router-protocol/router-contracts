import chai, { expect } from "chai";
import { Contract, logger, utils } from "ethers";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { ParamType, defaultAbiCoder } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);

const CHAIN_ID = "1";
const POWERS = [4294967295];
const TIMESTAMP = 1752503506;
const EXPIRED_TIMESTAMP = 1672503506;
const VALSET_NONCE: number = 1;
const ROUTER_BRIDGE_ADDRESS = "router10emt4hxmeyr8mjxayyt8huelzd7fpntmly8vus5puelqde6kn8xqcqa30g";
const RELAYER_ROUTER_ADDRESS = "router1hrpna9v7vs3stzyd4z3xf00676kf78zpe2u5ksvljswn2vnjp3ys8kpdc7";
const IRECEIVE_METHOD_NAME = "0x6952656365697665000000000000000000000000000000000000000000000000";
const IACK_METHOD_NAME = "0x6941636b00000000000000000000000000000000000000000000000000000000";
const amount = "100000";
const recipient = "0xdE23C5FfC7B045b48F0B85ADA2c518d213d9e24F";

const requestPayloadString =
    "tuple(uint256 routeAmount, uint256 requestIdentifier, uint256 requestTimestamp, address routeRecipient, address asmAddress, string srcChainId,string destChainId,bytes requestSender, bytes requestPacket, bool isReadCall)";
const requestPayloadAbi = ParamType.from(requestPayloadString);

const ackPayloadString =
    "tuple(uint256 requestIdentifier, string relayerRouterAddress, string destChainId, bytes requestSender, bytes execData, bool execFlag)";
const ackPayloadAbi = ParamType.from(ackPayloadString);

describe("Gateway Testing", function () {
    let testRoute: Contract;
    let valsetUpdate: Contract;
    let vault: Contract;
    let gateway: Contract;
    let signers: SignerWithAddress[];
    let VALIDATORS: string[];

    function getRequestMetadata(
        destGasLimit: number,
        destGasPrice: number,
        ackGasLimit: number,
        ackGasPrice: number,
        relayerFees: string,
        ackType: number,
        isReadCall: boolean,
        asmAddress: string
    ): string {
        return ethers.utils.solidityPack(
            ["uint64", "uint64", "uint64", "uint64", "uint128", "uint8", "bool", "string"],
            [destGasLimit, destGasPrice, ackGasLimit, ackGasPrice, relayerFees, ackType, isReadCall, asmAddress]
        );
    }

    beforeEach(async () => {
        const TestRoute = await ethers.getContractFactory("TestRoute");
        testRoute = await TestRoute.deploy();

        const ValsetUpdate = await ethers.getContractFactory("ValsetUpdate");
        valsetUpdate = await ValsetUpdate.deploy();

        signers = await ethers.getSigners();
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
        await testRoute.grantRole("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", vault.address);
    });

    it("Uninitialized Contract Test", async function () {
        expect(await gateway.chainId()).to.be.equal("");
        expect(await gateway.stateLastValsetCheckpoint()).to.be.equals(
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        );
    });

    it("Should init the Contract", async function () {
        expect(gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE))
            .to.be.emit(gateway, "ValsetUpdatedEvent")
            .withArgs(VALSET_NONCE, 1, CHAIN_ID, VALIDATORS, POWERS);
        expect(await gateway.eventNonce()).to.be.equal(1);
        expect(await gateway.chainId()).to.be.equal(CHAIN_ID);

        expect(await gateway.stateLastValsetCheckpoint()).to.be.equals(
            "0xbb53d22d9addf5d56659d122b3758e6f8ef51c9757708dca88419e5720a2e275"
        );
        expect(
            await gateway.hasRole(
                "0x0000000000000000000000000000000000000000000000000000000000000000",
                signers[0].address
            )
        ).to.be.true;
    });

    it("Should revert while calling the init function second time", async function () {
        gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
        expect(gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE)).to.be.revertedWith(
            "Initializable: contract is already initialized"
        );
    });

    it("Should revert with the InsufficientPower custom error", async function () {
        const signers = await ethers.getSigners();
        var VALIDATORS = [signers[0].address, signers[1].address, signers[2].address, signers[3].address];
        var POWERS = [9, 9, 9, 9];

        const Gateway1 = await ethers.getContractFactory("GatewayUpgradeable", {
            libraries: {
                ValsetUpdate: valsetUpdate.address
            }
        });
        const gateway1 = await Gateway1.deploy();
        expect(gateway1.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE)).to.be.revertedWith("InsufficientPower");
    });

    // GAS - 66299
    it("Should call the send cross chain request", async function () {
        gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
        const HelloWorld = await ethers.getContractFactory("HelloWorld");
        const helloWorld = await HelloWorld.deploy(gateway.address, testRoute.address, vault.address);

        expect(await helloWorld.gatewayContract()).to.be.equals(gateway.address);

        await gateway.setVault(vault.address);

        const version = 1;
        const routeAmount = "10";
        const routeRecipient = recipient;
        const destChainId = "2";
        const destContractAddress = helloWorld.address;
        const gasLimit = 1000000;
        const relayerFees = 1000000;
        const ackType = 1;
        const ackGasLimit = 1000000;
        const isReadCalls = false;
        const asmAddress = "";

        await testRoute.approve(helloWorld.address, amount);

        const expectedRequestMetadata = getRequestMetadata(
            gasLimit,
            0,
            ackGasLimit,
            0,
            relayerFees.toString(),
            1,
            isReadCalls,
            asmAddress
        );

        const payload = utils.defaultAbiCoder.encode(["string"], ["Hello Router"]);

        const expectedRequestPacket = utils.defaultAbiCoder.encode(["string", "bytes"], [helloWorld.address, payload]);

        await expect(
            helloWorld.iSend(routeAmount, routeRecipient, destChainId, destContractAddress, ackType, relayerFees)
        )
            .to.emit(gateway, "ISendEvent")
            .withArgs(
                version,
                routeAmount,
                2,
                helloWorld.address,
                CHAIN_ID,
                destChainId,
                recipient,
                expectedRequestMetadata,
                expectedRequestPacket
            );
        await expect(
            helloWorld.iSend(routeAmount, routeRecipient, destChainId, destContractAddress, ackType, relayerFees)
        )
            .to.emit(gateway, "ISendEvent")
            .withArgs(
                version,
                routeAmount,
                3,
                helloWorld.address,
                CHAIN_ID,
                destChainId,
                recipient,
                expectedRequestMetadata,
                expectedRequestPacket
            );
    });

    // GAS - 105693
    it("Should call Handle Cross Chain Request", async function () {
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

        const helloWorldAddress = helloWorld.address.toLowerCase();
        let packet = utils.defaultAbiCoder.encode(["string"], ["hello router"]);
        let nonce = 12;

        // const requestPacket = utils.defaultAbiCoder.encode(["bytes", "bytes"], [helloWorldAddress, payload]);

        const requestPayload = {
            routeAmount: amount,
            requestIdentifier: nonce,
            requestTimestamp: TIMESTAMP,
            routeRecipient: recipient,
            asmAddress: "0x0000000000000000000000000000000000000000",
            srcChainId: "80001",
            destChainId: "1",
            requestSender: helloWorld.address,
            isReadCall: false,
            handlerAddress: helloWorld.address,
            packet: packet
            // requestPacket: requestPacket
        };

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
                IRECEIVE_METHOD_NAME,
                requestPayload.routeAmount,
                requestPayload.requestIdentifier,
                requestPayload.requestTimestamp,
                requestPayload.srcChainId,
                requestPayload.routeRecipient,
                requestPayload.destChainId,
                requestPayload.asmAddress,
                requestPayload.requestSender,
                requestPayload.handlerAddress,
                requestPayload.packet,
                requestPayload.isReadCall
            ]
        );

        const testBytes = utils.arrayify(encoded_data);
        const messageHash = utils.keccak256(testBytes);

        const messageHashBytes = utils.arrayify(messageHash);

        console.log("messageHash: ", messageHash);

        let sign = await signers[0].signMessage(messageHashBytes);

        let expectedPayload =
            "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000c68656c6c6f20726f757465720000000000000000000000000000000000000000";

        expectedPayload = utils.defaultAbiCoder.encode(["bytes"], [packet]);

        await expect(gateway.iReceive(_currentValset, [sign], requestPayload, RELAYER_ROUTER_ADDRESS))
            .to.emit(gateway, "IReceiveEvent")
            .withArgs(nonce, 2, "80001", "1", RELAYER_ROUTER_ADDRESS, helloWorld.address, expectedPayload, true);

        const newRequestPayload = {
            routeAmount: amount,
            requestIdentifier: nonce + 1,
            requestTimestamp: TIMESTAMP,
            routeRecipient: recipient,
            asmAddress: "0x0000000000000000000000000000000000000000",
            srcChainId: "80001",
            destChainId: "1",
            requestSender: helloWorld.address.toString(),
            handlerAddress: helloWorld.address.toString(),
            packet: packet,
            isReadCall: false
        };

        let new_encoded_data = utils.defaultAbiCoder.encode(
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
                IRECEIVE_METHOD_NAME,
                newRequestPayload.routeAmount,
                newRequestPayload.requestIdentifier,
                newRequestPayload.requestTimestamp,
                newRequestPayload.srcChainId,
                newRequestPayload.routeRecipient,
                newRequestPayload.destChainId,
                newRequestPayload.asmAddress,
                newRequestPayload.requestSender,
                newRequestPayload.handlerAddress,
                newRequestPayload.packet,
                newRequestPayload.isReadCall
            ]
        );

        // let new_encoded_data = utils.defaultAbiCoder.encode(
        //     ["bytes32", requestPayloadAbi],
        //     [IRECEIVE_METHOD_NAME, newRequestPayload]
        // );

        const newTestBytes = utils.arrayify(new_encoded_data);
        const newMessageHash = utils.keccak256(newTestBytes);

        const newMessageHashBytes = utils.arrayify(newMessageHash);

        let sig = await signers[0].signMessage(newMessageHashBytes);
        // let signature2 = utils.splitSignature(sig);

        // let sigs = [{ r: signature2.r, s: signature2.s, v: signature2.v }];

        await gateway.iReceive(_currentValset, [sig], newRequestPayload, RELAYER_ROUTER_ADDRESS);

        const contractCallsResult = defaultAbiCoder.decode(["bytes"], expectedPayload);
        expect(contractCallsResult[0]).equals(packet);

        const balance = await testRoute.balanceOf(signers[0].address);
        expect(balance.toString()).equals(amount);
    });

    // GAS - 62225
    it("Should call Cross Talk Acknowledgement", async function () {
        gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
        const HelloWorld = await ethers.getContractFactory("HelloWorld");
        const helloWorld = await HelloWorld.deploy(gateway.address, testRoute.address, vault.address);

        expect(await helloWorld.gatewayContract()).to.be.equals(gateway.address);

        let _currentValset = {
            validators: VALIDATORS,
            powers: POWERS,
            valsetNonce: VALSET_NONCE
        };
        let destChainId = "2";
        let requestIdentifier = 1;
        let ackRequestIdentifier = 1;
        let execFlag = true;
        let execData = utils.defaultAbiCoder.encode(["string"], ["Hello"]);
        const helloWorldAddress = helloWorld.address;

        let crossChainAckPayload = {
            requestIdentifier: requestIdentifier,
            ackRequestIdentifier: ackRequestIdentifier,
            destChainId: destChainId,
            requestSender: helloWorldAddress,
            execFlag: execFlag,
            execData: execData
        };

        let encoded_data = utils.defaultAbiCoder.encode(
            ["bytes32", "string", "uint256", "uint256", "string", "address", "bytes", "bool"],
            [
                IACK_METHOD_NAME,
                CHAIN_ID,
                crossChainAckPayload.requestIdentifier,
                crossChainAckPayload.ackRequestIdentifier,
                crossChainAckPayload.destChainId,
                crossChainAckPayload.requestSender,
                crossChainAckPayload.execData,
                crossChainAckPayload.execFlag
            ]
        );

        const testBytes = utils.arrayify(encoded_data);
        const messageHash = utils.keccak256(testBytes);

        const messageHashBytes = utils.arrayify(messageHash);

        let sign = await signers[0].signMessage(messageHashBytes);
        // let signature1 = utils.splitSignature(sign);

        // let _sigs = [{ r: signature1.r, s: signature1.s, v: signature1.v }];

        await expect(gateway.iAck(_currentValset, [sign], crossChainAckPayload, RELAYER_ROUTER_ADDRESS))
            .to.emit(gateway, "IAckEvent")
            .withArgs(requestIdentifier + 1, requestIdentifier, RELAYER_ROUTER_ADDRESS, CHAIN_ID, "0x", true);

        let newCrossChainAckPayload = {
            relayerRouterAddress: RELAYER_ROUTER_ADDRESS,
            requestIdentifier: requestIdentifier + 1,
            ackRequestIdentifier: ackRequestIdentifier + 1,
            destChainId: destChainId,
            requestSender: helloWorldAddress,
            execFlag: execFlag,
            execData: execData
        };

        let new_encoded_data = utils.defaultAbiCoder.encode(
            ["bytes32", "string", "uint256", "uint256", "string", "address", "bytes", "bool"],
            [
                IACK_METHOD_NAME,
                CHAIN_ID,
                newCrossChainAckPayload.requestIdentifier,
                newCrossChainAckPayload.ackRequestIdentifier,
                newCrossChainAckPayload.destChainId,
                newCrossChainAckPayload.requestSender,
                newCrossChainAckPayload.execData,
                newCrossChainAckPayload.execFlag
            ]
        );

        // let new_encoded_data = utils.defaultAbiCoder.encode(
        //     ["bytes32", "string", ackPayloadAbi],
        //     [IACK_METHOD_NAME, CHAIN_ID, newCrossChainAckPayload]
        // );
        const newTestBytes = utils.arrayify(new_encoded_data);
        const newMessageHash = utils.keccak256(newTestBytes);

        const newMessageHashBytes = utils.arrayify(newMessageHash);

        let newSign = await signers[0].signMessage(newMessageHashBytes);
        // let signature2 = utils.splitSignature(newSign);

        // let sigs = [{ r: signature2.r, s: signature2.s, v: signature2.v }];

        await gateway.iAck(_currentValset, [newSign], newCrossChainAckPayload, RELAYER_ROUTER_ADDRESS);

        console.log(await helloWorld.ackMessage());
    });

    it("Get signature", async function () {
        console.log("Signer: ", signers[0].address);
        const encodedData =
            "0x695265636569766500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000009184e72a000000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000026000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e73686976616d2e746573746e6574000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d76656e6b792e746573746e657400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000538303030310000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007746573746e65740000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060102030405060000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000001073686173687661742e746573746e65740000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000548656c6c6f000000000000000000000000000000000000000000000000000000";
        const testBytes = utils.arrayify(encodedData);
        const messageHash = utils.keccak256(testBytes);
        const messageHashBytes = utils.arrayify(messageHash);
        let sign = await signers[0].signMessage(messageHashBytes);
        console.log("Signature: ", sign);

        let signature1 = utils.splitSignature(sign);
        console.log(signature1);
    });
});
