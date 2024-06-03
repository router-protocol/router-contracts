# Router EVM Gateway contracts

## Overview

The Router <mark>EVM Gateway contract</mark> will bridge EVM chains with the Router Chain.
We can deploy this gateway contract on any EVM-compatible chain.
The gateway contract validates all incoming requests coming from the router chain using the
validator set signatures. These signatures should have at-least 2/3 validator power.
The current validator set(valset) can update the validator set to a new valset by invoking the _updateValset_ function.

The Gateway contract has a function iSend to send request to other chains, a function iReceive to receive requests from another chain and iAck to receive acknowledgments back from destination chain.

For more details, please check [here](https://router-chain-docs.vercel.app/develop/message-transfer-via-crosstalk/evm-guides/iDapp-functions).

## Please use the following instruction to setup, test and deploy the project

## Setup

To run any command you need to have .env in your local

```
cd router-gateway-contracts/evm
cp .env.test .env
```

then update the value in .env file.

## Compile Project

```
cd router-gateway-contracts/evm
npm install
npx hardhat compile
```

## Run Tests

Use the following commands to run the test cases:

```
npx hardhat test
```

## Deploy Gateway Contract on live network

```
cd router-gateway-contracts/evm
npx hardhat deploy:Gateway --network <network> --valsetnonce <valsetNonce> --validators <validators> --powers <powers>
```

## Deployment On Tron Network

```
yarn compile:tron
```

```
npx hardhat deploy:TronGateway --net <TronNetwork> --valsetnonce <valsetNonce> --validators <validators> --powers <powers>

# example
npx hardhat deploy:TronGateway --net shasta --valsetnonce 2 --validators "0x5D7a34f8C210ce35a6a4Cf6Bf3775a15C0EcF67a,0x552f59C5Bd1047388c80f72a54CBE6b4A699dbc2" --powers "1287847942,2104823431"
```

## Upgrade Gateway Contract on live network

```
cd router-gateway-contracts/evm
npx hardhat upgrade:Gateway --network <network>
```

## Upgrade Gateway Contract on Tron network

```
npx hardhat upgrade:GatewayTron --net <TronNetwork>
```

## Verify GateWay Contract on a network

```
cd router-gateway-contracts/evm
npx hardhat verify --constructor-args <args-file-path> <gateway-contract-address> --network <network-name>
```

Example:-

```
npx hardhat verify --constructor-args scripts/arguments.js 0x610aEe9387488398c25Aca6aDFBac662177DB24D --network polygonMumbai
```

## Generate ABIs, BIN and GO bindings of the Gateway Contract

```
cd router-gateway-contracts
npm install
sh scripts/createBinding.sh
```
