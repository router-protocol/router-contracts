import chai, { expect } from "chai";
import { Contract, utils } from "ethers";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { defaultAbiCoder } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);

const CHAIN_ID: string = "1";
const POWERS = [4294967295];
const TIMESTAMP = 1752503506;
const EXPIRED_TIMESTAMP = 1672503506;
const VALSET_NONCE: number = 1;
const I_RECEIVE_BYTES = "0x6952656365697665000000000000000000000000000000000000000000000000";
const ROUTER_BRIDGE_ADDRESS = "router10emt4hxmeyr8mjxayyt8huelzd7fpntmly8vus5puelqde6kn8xqcqa30g";
const RELAYER_ROUTER_ADDRESS = "router1hrpna9v7vs3stzyd4z3xf00676kf78zpe2u5ksvljswn2vnjp3ys8kpdc7";
const amount = "100000";
const recipient = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

describe("Gateway Testing", function () {
    let testRoute: Contract;
    let valsetUpdate: Contract;
    let vault: Contract;
    let gateway: Contract;
    let signers: SignerWithAddress[];
    let VALIDATORS: string[];

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
        await testRoute.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", vault.address);
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
        expect(await gateway.chainId()).to.be.equal("1");

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

    it("Should call iRequest", async function () {
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
        const callPayload = utils.defaultAbiCoder.encode(["string"], ["Hello String"]);
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
                false
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
            isReadCall: false
        };

        let execData =
            "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000c48656c6c6f20537472696e670000000000000000000000000000000000000000";

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

        const rawBytes = defaultAbiCoder.decode(["bytes"], execData);
        const greeting = defaultAbiCoder.decode(["string"], rawBytes[0]);
        expect(greeting[0]).equals("Hello String");
        const balance = await testRoute.balanceOf(signers[0].address);
        expect(balance).equals(parseInt(amount) + 100000);
    });

    it("Invalid ChainId Request from Router", async function () {
        await gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
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
        const callPayload = utils.defaultAbiCoder.encode(["string"], ["Hello String"]);
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
                // Invalid Chain Id
                "23",
                recipient,
                CHAIN_ID,
                asmAddress,
                requestSender,
                handlerBytes,
                callPayload,
                false
            ]
        );
        let testBytes = utils.arrayify(encoded_data);
        let messageHash = utils.keccak256(testBytes);

        let messageHashBytes = utils.arrayify(messageHash);

        let sign = await signers[0].signMessage(messageHashBytes);

        let _sigs = [sign];
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
            isReadCall: false
        };
        await expect(
            gateway.iReceive(_currentValset, _sigs, requestPayload, RELAYER_ROUTER_ADDRESS)
        ).to.be.revertedWith("InvalidSignature()");
        encoded_data = utils.defaultAbiCoder.encode(
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
                "23",
                asmAddress,
                requestSender,
                handlerBytes,
                callPayload,
                false
            ]
        );
        testBytes = utils.arrayify(encoded_data);
        messageHash = utils.keccak256(testBytes);

        messageHashBytes = utils.arrayify(messageHash);

        sign = await signers[0].signMessage(messageHashBytes);

        _sigs = [sign];
        requestPayload = {
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
            isReadCall: false
        };

        await expect(
            gateway.iReceive(_currentValset, _sigs, requestPayload, RELAYER_ROUTER_ADDRESS)
        ).to.be.revertedWith("InvalidSignature()");
    });

    it("Should call UpdateValset", async function () {
        await gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);

        var newValidators = [signers[1].address];
        let newValset = {
            validators: newValidators,
            powers: POWERS,
            valsetNonce: 12
        };

        let _currentValset = {
            validators: VALIDATORS,
            powers: POWERS,
            valsetNonce: VALSET_NONCE
        };

        let encoded_data = utils.defaultAbiCoder.encode(
            ["bytes32", "uint64", "address[]", "uint64[]"],
            [
                "0x636865636b706f696e7400000000000000000000000000000000000000000000",
                newValset.valsetNonce,
                newValset.validators,
                newValset.powers
            ]
        );
        const testBytes = utils.arrayify(encoded_data);
        const messageHash = utils.keccak256(testBytes);

        const messageHashBytes = utils.arrayify(messageHash);
        let sign = await signers[0].signMessage(messageHashBytes);

        let _sigs = [sign];

        await expect(gateway.updateValset(newValset, _currentValset, _sigs))
            .to.emit(gateway, "ValsetUpdatedEvent")
            .withArgs(newValset.valsetNonce, 2, CHAIN_ID, newValset.validators, newValset.powers);
        expect(await gateway.stateLastValsetCheckpoint()).to.be.equals(messageHash);
    });

    it("Should call iSend", async function () {
        await gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
        console.log(VALIDATORS[0].toLowerCase());
        console.log(recipient);
        await gateway.setVault(vault.address);
        let reqMetaData = "0x";
        let reqPacket = "0x";
        let version = "1";
        let currentNonce = parseInt(await gateway.eventNonce()) + 1;

        await testRoute.increaseAllowance(vault.address, amount);
        await expect(await gateway.iSend(version, amount, signers[1].address, CHAIN_ID, reqMetaData, reqPacket))
            .to.be.emit(gateway, "ISendEvent")
            .withArgs(
                version,
                amount,
                currentNonce,
                VALIDATORS[0],
                CHAIN_ID,
                CHAIN_ID,
                signers[1].address,
                reqMetaData,
                reqPacket
            );
    });
});
