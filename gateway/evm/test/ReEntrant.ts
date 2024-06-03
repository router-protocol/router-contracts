import chai, { assert, expect } from "chai";
import { Contract, utils } from "ethers";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { defaultAbiCoder } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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

describe("ReEntrant Deployment", function () {
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

    it("Should call Re-Entrancy Function", async function () {
        await gateway.initialize(CHAIN_ID, VALIDATORS, POWERS, VALSET_NONCE);
        await gateway.setVault(vault.address);

        const ReEntrant = await ethers.getContractFactory("ReEntrant");
        const reEntrant = await ReEntrant.deploy(gateway.address);

        expect(await reEntrant.gatewayContract()).to.be.equals(gateway.address);

        let _currentValset = {
            validators: VALIDATORS,
            powers: POWERS,
            valsetNonce: VALSET_NONCE
        };
        const requestIdentifier = 12;
        const handlerBytes = reEntrant.address;
        const requestSender = "0x00000000000000000000";
        const asmAddress = recipient;

        let greeting = "Hello RE-ENTRANCY";
        const reEntrantPayload = defaultAbiCoder.encode(["string"], [greeting]);

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
                reEntrantPayload,
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
            packet: reEntrantPayload,
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
        expect(reEntrant.greeting(), greeting);
    });

    it("Should call Request to Router from OutBound", async function () {
        let str =
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoAAAAAAAAAAAAAAAAKxO0y2cfyp+1vqiX3we+6EAUCuRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApUZXN0IFRva2VuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEVVNEQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        let hex_str = "0x" + Buffer.from(str, "base64").toString("hex");
        console.log(hex_str);
        console.log(defaultAbiCoder.decode(["string", "string", "address"], hex_str));

        // let data = defaultAbiCoder.decode(["uint64", "string", "string", "address"], innerPaylaod);
        // assert.equal(data[0], 0);
        // assert.equal(data[1], chainId);
        // assert.equal(data[2], str);
        // assert.equal(data[3], destinationContractAddress);
    });
});
