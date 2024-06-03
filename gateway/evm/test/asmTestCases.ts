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
const amount = "100000";
const I_RECEIVE_BYTES = "0x6952656365697665000000000000000000000000000000000000000000000000";
const ROUTER_BRIDGE_ADDRESS = "router10emt4hxmeyr8mjxayyt8huelzd7fpntmly8vus5puelqde6kn8xqcqa30g";
const RELAYER_ROUTER_ADDRESS = "router1hrpna9v7vs3stzyd4z3xf00676kf78zpe2u5ksvljswn2vnjp3ys8kpdc7";
const REQ_FROM_SOURCE_METHOD_NAME = "0x7265717565737446726f6d536f75726365000000000000000000000000000000";
const CROSS_TALK_ACK_METHOD_NAME = "0x63726F737354616C6B41636B0000000000000000000000000000000000000000";
const TIMESTAMP = 1726142964;
const recipient = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

describe("Additional Security Module Testing", function () {
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

    it("Call asm Module testing in Request from Router", async function () {
        await gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
        await gateway.setBridgeFees("1000");

        console.log(VALIDATORS[0].toLowerCase());
        console.log(recipient);
        await gateway.setVault(vault.address);
        let reqMetaData = "0x";
        let reqPacket = "0x";
        let version = "1";
        let currentNonce = parseInt(await gateway.eventNonce()) + 1;

        await testRoute.increaseAllowance(vault.address, amount);
        await expect(
            await gateway.iSend(version, "50000", signers[1].address, CHAIN_ID, reqMetaData, reqPacket, {
                value: "2000"
            })
        )
            .to.be.emit(gateway, "ISendEvent")
            .withArgs(
                version,
                "50000",
                currentNonce,
                VALIDATORS[0],
                CHAIN_ID,
                CHAIN_ID,
                signers[1].address,
                reqMetaData,
                reqPacket
            );

        await expect(
            await gateway.iSend("1", "50000", signers[1].address, CHAIN_ID, reqMetaData, reqPacket, {
                value: "2000"
            })
        )
            .to.be.emit(gateway, "ISendEvent")
            .withArgs(
                version,
                "50000",
                currentNonce + 1,
                VALIDATORS[0],
                CHAIN_ID,
                CHAIN_ID,
                signers[1].address,
                reqMetaData,
                reqPacket
            );
    });

    it("Should call Request from Destination Chain", async function () {
        gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
        const HelloWorld = await ethers.getContractFactory("HelloWorld");
        const helloWorld = await HelloWorld.deploy(gateway.address, testRoute.address, vault.address);
        const DelayASM = await ethers.getContractFactory("DelayASM");
        const delayASM = await DelayASM.deploy(gateway.address, 3, ROUTER_BRIDGE_ADDRESS);

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

        const blockNumAfter = await ethers.provider.getBlockNumber();
        const blockAfter = await ethers.provider.getBlock(blockNumAfter);
        let current_timestamp = blockAfter.timestamp;
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
                current_timestamp,
                CHAIN_ID,
                recipient,
                CHAIN_ID,
                delayASM.address,
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
            requestTimestamp: current_timestamp,
            srcChainId: CHAIN_ID,
            routeRecipient: recipient,
            destChainId: CHAIN_ID,
            asmAddress: delayASM.address,
            requestSender: requestSender,
            handlerAddress: handlerBytes,
            packet: callPayload,
            isReadCall: false
        };

        await expect(
            gateway.iReceive(_currentValset, _sigs, requestPayload, RELAYER_ROUTER_ADDRESS)
        ).to.be.revertedWith("Transaction needs to be delayed");
        await ethers.provider.send("evm_mine", [current_timestamp + 2]);

        await expect(
            gateway.iReceive(_currentValset, _sigs, requestPayload, RELAYER_ROUTER_ADDRESS)
        ).to.be.revertedWith("Transaction needs to be delayed");
        await ethers.provider.send("evm_mine", [current_timestamp + 4]);

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
        expect(await helloWorld.greeting()).to.be.equals("Hello String");
        const rawBytes = defaultAbiCoder.decode(["bytes"], execData);
        const greeting = defaultAbiCoder.decode(["string"], rawBytes[0]);
        expect(greeting[0]).equals("Hello String");
    });
});
