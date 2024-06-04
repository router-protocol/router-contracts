# hardhat-boilerplate

- [Hardhat](https://github.com/nomiclabs/hardhat): compile and run the smart contracts on a local development network
- [TypeChain](https://github.com/ethereum-ts/TypeChain): generate TypeScript types for smart contracts
- [Ethers](https://github.com/ethers-io/ethers.js/): renowned Ethereum library and wallet implementation
- [Waffle](https://github.com/EthWorks/Waffle): tooling for writing comprehensive smart contract tests
- [Solhint](https://github.com/protofire/solhint): linter
- [Solcover](https://github.com/sc-forks/solidity-coverage): code coverage
- [Prettier Plugin Solidity](https://github.com/prettier-solidity/prettier-plugin-solidity): code formatter

## Usage

### Pre Requisites

Before running any command, make sure to install dependencies:

```sh
$ yarn install
```

### Set up .env

Copy .env.example to .env and update MNEMONIC

```
cp .env.example .env
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ yarn compile
```

### Compile For Tron

Compile the smart contracts with Tronbox:

```sh
$ yarn compile:tron
```

### TypeChain

Compile the smart contracts and generate TypeChain artifacts:

```sh
$ yarn typechain
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Test

Run the Mocha tests:

```sh
$ yarn test
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Report Gas

See the gas usage per unit test and average gas per method call:

```sh
$ REPORT_GAS=true yarn test
```

### Deploy

Deploy the contracts to Hardhat Network:

```sh
$ npx hardhat deploy:AssetBridge --env "testnet or alpha or devnet" --network ..
```

e.g Deploy the contracts to a specific network, such as the mumbai testnet:

```sh
$ npx hardhat deploy:AssetBridge --env "alpha" --network mumbai
```

### Configure

```sh
$ npx hardhat Configure:AssetBridge --env "testnet or alpha or devnet" --network ..
```

e.g Configuring the contracts to a specific network, such as the mumbai testnet:

```sh
$ npx hardhat Configure:AssetBridge --env "alpha" --network mumbai
```

### Deploy On Tron

```sh
$ npx hardhat deploy:AssetBridgeTron --env "testnet or alpha or devnet" --net "shasta or nile"
```

e.g

```sh
$ npx hardhat deploy:AssetBridgeTron --env "alpha" --net shasta
```

### Configure For Tron

Deploy the contracts to Hardhat Network:

```sh
$ npx hardhat Configure:AssetBridge --env "testnet or alpha or devnet" --network ..
```

e.g:

```sh
$ npx hardhat Configure:AssetBridgeTron --env "alpha" --net shasta
```

Note: Change constants as per need in tasks/constants.ts and deployment/config info for configuring contract

## Syntax Highlighting

If you use VSCode, you can enjoy syntax highlighting for your Solidity code via the
[vscode-solidity](https://github.com/juanfranblanco/vscode-solidity) extension. The recommended approach to set the
compiler version is to add the following fields to your VSCode user settings:

```json
{
  "solidity.compileUsingRemoteVersion": "v0.8.4+commit.c7e474f2",
  "solidity.defaultCompiler": "remote"
}
```

Where of course `v0.8.4+commit.c7e474f2` can be replaced with any other version.
