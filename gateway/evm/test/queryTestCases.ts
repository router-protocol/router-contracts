import chai, { expect } from "chai";
import { Contract, utils } from "ethers";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { defaultAbiCoder } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GatewayUpgradeable, GatewayUpgradeable__factory } from "../typechain";

chai.use(solidity);

const CHAIN_ID: string = "1";
const DEST_CHAIN_ID: string = "2";
const POWERS = [4294967295];
const VALSET_NONCE: number = 1;
const RELAYER_ROUTER_ADDRESS = "router1hrpna9v7vs3stzyd4z3xf00676kf78zpe2u5ksvljswn2vnjp3ys8kpdc7";
const READ_CALL = "0x8da5cb5b";
const amount = "100000";
const recipient = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const I_RECEIVE_BYTES = "0x6952656365697665000000000000000000000000000000000000000000000000";
const TIMESTAMP = 1752503506;
const IACK_METHOD_NAME = "0x6941636b00000000000000000000000000000000000000000000000000000000";

describe("Gateway Read Query Testing", function () {
    let gateway: Contract;
    let signers: SignerWithAddress[];
    let VALIDATORS: string[];
    let testRoute: Contract;
    let valsetUpdate: Contract;
    let vault: Contract;

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

        await testRoute.mint(signers[0].address, "300000");
        await testRoute.approve(vault.address, "300000");
        await testRoute.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", vault.address);
        await testRoute.grantRole("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", vault.address);
    });

    it("Should call Read Query To Destination Chain", async function () {
        await gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
        await gateway.setBridgeFees("1000");
        await gateway.setVault(vault.address);

        let reqMetaData = utils.defaultAbiCoder.encode(
            ["uint64", "uint64", "uint64", "uint64", "uint128", "uint8", "bool", "bytes"],
            [0, 0, 0, 0, 0, 1, true, "0x"]
        );
        let reqPacket = utils.defaultAbiCoder.encode(
            ["string", "bytes"],
            ["0x5b38da6a701c568545dcfcb03fcb875f56beddc4", READ_CALL]
        );
        let version = "1";
        let currentNonce = parseInt(await gateway.eventNonce()) + 1;

        await testRoute.increaseAllowance(vault.address, amount);
        await expect(
            await gateway.iSend(version, amount, signers[1].address, DEST_CHAIN_ID, reqMetaData, reqPacket, {
                value: "2000"
            })
        )
            .to.be.emit(gateway, "ISendEvent")
            .withArgs(
                version,
                amount,
                currentNonce,
                VALIDATORS[0],
                CHAIN_ID,
                DEST_CHAIN_ID,
                signers[1].address,
                reqMetaData,
                reqPacket
            );

        await testRoute.increaseAllowance(vault.address, amount);
        await expect(
            await gateway.iSend(version, amount, signers[1].address, CHAIN_ID, reqMetaData, reqPacket, {
                value: "2000"
            })
        )
            .to.be.emit(gateway, "ISendEvent")
            .withArgs(
                version,
                amount,
                currentNonce + 1,
                VALIDATORS[0],
                CHAIN_ID,
                CHAIN_ID,
                signers[1].address,
                reqMetaData,
                reqPacket
            );
    });

    it("Should fail as insufficient fees sent", async function () {
        await gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
        await gateway.setBridgeFees("1000");
        await gateway.setVault(vault.address);

        let reqMetaData = utils.defaultAbiCoder.encode(
            ["uint64", "uint64", "uint64", "uint64", "uint128", "uint8", "bool", "bytes"],
            [0, 0, 0, 0, 0, 1, true, "0x"]
        );
        let reqPacket = utils.defaultAbiCoder.encode(
            ["string", "bytes"],
            ["0x5b38da6a701c568545dcfcb03fcb875f56beddc4", READ_CALL]
        );
        let version = "1";
        let currentNonce = parseInt(await gateway.eventNonce()) + 1;

        await testRoute.increaseAllowance(vault.address, amount);
        await expect(
            gateway.iSend(version, amount, signers[1].address, DEST_CHAIN_ID, reqMetaData, reqPacket, {
                value: "500"
            })
        ).to.be.revertedWith("C03");
    });

    it("Should call IReceive for read query", async function () {
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
        const handlerBytes = helloWorld.address;
        const callPayload = READ_CALL;
        const requestSender = "0x00000000000000000000";
        const asmAddress = recipient;
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
                callPayload,
                true
            ]
        );
        const testBytes = utils.arrayify(encoded_data);
        const messageHash = utils.keccak256(testBytes);

        const messageHashBytes = utils.arrayify(messageHash);

        let sign = await signers[0].signMessage(messageHashBytes);

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
            packet: callPayload,
            isReadCall: true
        };

        let execData = utils.defaultAbiCoder.encode(["address"], [signers[0].address]);
        await expect(gateway.iReceive(_currentValset, _sigs, requestPayload, RELAYER_ROUTER_ADDRESS))
            .to.emit(gateway, "IReceiveEvent")
            .withArgs(
                requestIdentifier,
                currentNonce,
                CHAIN_ID,
                CHAIN_ID,
                RELAYER_ROUTER_ADDRESS,
                requestSender,
                execData,
                true
            );
        expect(await helloWorld.owner()).to.be.equals(signers[0].address);
        // const contractCallsResult = defaultAbiCoder.decode(["bool", "bytes"], execData);
        // expect(contractCallsResult[0]).equals(true);
        // const decodeResponse = defaultAbiCoder.decode(["uint256"], contractCallsResult[1][0]);
        // expect(decodeResponse.toString()).to.equals("20");
    });

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
    });
});
