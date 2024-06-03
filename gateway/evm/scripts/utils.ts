import { Interface, ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
const deployment = require("../deployment/deployments.json");

const deployments: IDeployment = deployment;
export interface IDeployment {
    [key: string]: {
        [key: string]: {
            proxy: string;
            implementation: Array<string>;
            creationTime: number;
            updatedTime: Array<number>;
            assetVault: string;
            valsetUpdate: string;
            routeToken: string;
            blockNumber: number;
        };
    };
}

export async function recordAllDeployments(
    network: string,
    contractname: string,
    proxyAddr: string,
    implementationAddr: string,
    assetVault: string,
    valsetUpdate: string,
    routeToken: string,
    blockNumber: number
) {
    if (!deployments[network]) deployments[network] = {};
    deployments[network][contractname] = {
        proxy: proxyAddr,
        implementation: [implementationAddr],
        creationTime: Date.now(),
        updatedTime: [Date.now()],
        assetVault,
        valsetUpdate,
        routeToken,
        blockNumber
    };

    return deployments;
}

export async function verify(hre: HardhatRuntimeEnvironment, inputContractAddr: string, isProxy: boolean, args?: any) {
    let contractAddr = inputContractAddr;
    if (isProxy) {
        const implementationAddr = await hre.upgrades.erc1967.getImplementationAddress(inputContractAddr);
        console.log("Contract Verification Started", implementationAddr);
    }

    let arg = args ? [...args] : undefined;
    try {
        await hre.run("verify:verify", {
            address: contractAddr,
            constructorArguments: arg
        });
    } catch (err) {
        console.error(err);
    }
    console.log("Contract Verification Ended");
}

require("dotenv").config();
const config = require("./tron.config.json");
const TronWeb = require("tronweb");

export class ExtraTronWeb {
    tronWeb: any;
    chainId: string;
    privateKey: string | undefined;
    constructor(net: string) {
        if (net != "shasta" && net != "nile" && net != "tron") throw new Error("Invalid network");
        this.privateKey = process.env.PRIVATE_KEY_SHASTA;
        if (!this.privateKey) throw new Error("Add PRIVATE_KEY_SHASTA in .env");

        const { fullNode, solidityNode, eventServer, chainId } = config[net];
        this.tronWeb = new TronWeb(fullNode, solidityNode, eventServer, this.privateKey);
        this.chainId = chainId;
    }

    fromHex(address: string): string {
        return this.tronWeb.address.fromHex(address);
    }

    toHex(address: string): string {
        return "0x" + this.tronWeb.address.toHex(address).slice(2);
    }

    async wait(txid: string, confirmationCount: number, pollingTime: number) {
        let currentBlockNumber = (await this.tronWeb.trx.getCurrentBlock()).block_header.raw_data.number;
        console.log("TxHash: ", txid, " Waiting for ", confirmationCount, " number of confirmation!!");
        //TODO: this will timeout after 30000sec
        while (true) {
            try {
                const transaction = await this.tronWeb.trx.getTransactionInfo(txid);
                if (transaction) {
                    if (transaction.receipt && transaction.receipt.result == "SUCCESS") return transaction; // tx got confirmed
                    if (transaction.blockNumber + confirmationCount < currentBlockNumber) return transaction;
                    await new Promise((resolve) => setTimeout(resolve, pollingTime));
                }
            } catch (err) {
                continue;
            }
        }
    }

    async signUnsignedTx(unsignedTransaction: any): Promise<any> {
        const signedTransaction = await this.tronWeb.trx.sign(unsignedTransaction, this.privateKey);
        // Add the wait method to the prototype of signedTx
        let transactionResult = await this.tronWeb.trx.sendRawTransaction(signedTransaction);
        transactionResult = {
            ...transactionResult,
            wait: async (confirmationCount = 22, pollingTime = 2000) =>
                this.wait(transactionResult.txid, confirmationCount, pollingTime)
        };
        return transactionResult;
    }

    async deploy(l_args: Object): Promise<any> {
        const unsignedTransaction = await this.tronWeb.transactionBuilder.createSmartContract(
            l_args,
            this.tronWeb.defaultAddress.base58 // hexstring or base58
        );

        return await this.signUnsignedTx(unsignedTransaction);
    }

    async deployProxy(
        l_args: any,
        parmas: unknown[] = [],
        opts: {
            initializer?: string | false;
            kind?: string;
        } = {}
    ): Promise<{
        impl: string;
        proxy: string;
        blockNumber: number;
    }> {
        //TODO: for now deploying all contract of kind uups
        const impl = await (await this.deploy(l_args)).wait();

        const data = this.getInitializerData(new ethers.Interface(l_args.abi), parmas, opts.initializer);
        const ERC1967Proxy = require("@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json");

        const proxy = await this.tronWeb.contract().new({
            abi: ERC1967Proxy.abi,
            bytecode: ERC1967Proxy.bytecode,
            feeLimit: l_args.feeLimit,
            userFeePercentage: l_args.userFeePercentage,
            name: `${l_args.name}_Proxy`,
            parameters: [this.toHex(impl.contract_address), data]
        });

        return {
            proxy: this.toHex(proxy.address),
            impl: this.toHex(impl.contract_address),
            blockNumber: impl.blockNumber
        };
    }

    async deployWithParams(l_args: any, parmas: any[]): Promise<any> {
        return await this.tronWeb.contract().new({
            abi: l_args.abi,
            bytecode: l_args.bytecode,
            feeLimit: l_args.feeLimit,
            userFeePercentage: 100,
            name: l_args.name,
            parameters: parmas
        });
    }

    async upgrade(
        l_args: any,
        proxyAddr: string
    ): Promise<{
        impl: string;
        proxy: string;
        txHash: any;
    }> {
        const impl = await (await this.deploy(l_args)).wait();
        const gatewayInstance = this.tronWeb.contract(l_args.abi, this.fromHex(proxyAddr));
        const upgradeTxHash = await (await gatewayInstance.upgradeTo(this.fromHex(impl.contract_address))).send();
        return {
            proxy: this.toHex(proxyAddr),
            impl: this.toHex(impl.contract_address),
            txHash: upgradeTxHash
        };
    }

    getInitializerData(contractInterface: Interface, args: unknown[], initializer?: string | false): string {
        if (initializer === false) {
            return "0x";
        }

        const allowNoInitialization = initializer === undefined && args.length === 0;
        initializer = initializer ?? "initialize";

        try {
            const fragment = contractInterface.getFunction(initializer);
            if (!fragment) throw "fragment is null";
            return contractInterface.encodeFunctionData(fragment, args);
        } catch (e: unknown) {
            if (e instanceof Error) {
                if (allowNoInitialization && e.message.includes("no matching function")) {
                    return "0x";
                }
            }
            throw e;
        }
    }
}
