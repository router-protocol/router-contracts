# Asset Forwarder

Asset Forwarder is a Solidity smart contract that enables trustless cross-chain token transfers. Users can deposit ERC20 tokens on the source chain, which are then forwarded to the destination chain by the forwarder.

# Installation and Setup

## Requirements

Please install the following:

- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
  - You'll know you've done it right if you can run `git --version`
- [Foundry / Foundryup](https://github.com/gakonst/foundry)

  - This will install `forge`, `cast`, and `anvil`
  - You can test you've installed them right by running `forge --version` and get an output like: `forge 0.2.0 (f016135 2022-07-04T00:15:02.930499Z)`
  - To get the latest of each, just run `foundryup`

- ```
   yarn install
  ```

- ```
  git submodule update --init --recursive
  ```

## Compile

```sh
forge compile
```

## Compile For Tron Using Tronbox

```sh
yarn compile:tron
```

## Testing

```sh
forge test
```

## Deploy and Verify

╰─ forge create --rpc-url <your_rpc_url>
--constructor-args "\_wrappedNativeTokenAddress" "\_gatewayContract" "\_usdcAddress" "\_tokenMessenger" "\_routerMiddlewareBase" "\_chainId" "\_minGasThreshhold" \\
--private-key <your_private_key> src/AssetForwarder.sol:AssetForwarder \\
--etherscan-api-key <your_etherscan_api_key> \\
--verify

```sh
e.g: ╰─ forge create --rpc-url "https://rpc.ankr.com/avalanche_fuji" --private-key "<Private Key>" src/AssetForwarder.sol:AssetForwarder --constructor-args "0xd00ae08403b9bbb9124bb305c09058e32c39a48c" "0x76b71BDC9f179d57E34a03740c62F2e88b7AA6A8" "0x5425890298aed601595a70AB815c96711a31Bc65" "0xeb08f243e5d3fcff26a9e38ae5520a669f4019d0" "0x726f757465723134686a32746176713866706573647778786375343472747933686839307668756a7276636d73746c347a723374786d667677397330307a74766b" "43113" 50000 --etherscan-api-key "95W6I9FT4DRDB45WMHKDXQCK8J4BX2JV62" --verify
```

## Deployment On Tron Network

╰─ ts-node ./scripts/deployTron.ts --args \_wrappedNativeTokenAddress,\_gatewayContract,\_usdcAddress,\_tokenMessenger,\_routerMiddlewareBase,\_chainId,\_minGasThreshhold

```sh
e.g: ╰─ ts-node ./scripts/deployTron.ts --net "shasta" --env "testnet" --args TMaytdK1v1D1Z2kYh2oXVsRzd7JA75Lx33,TJsFXzriKEuZKhajSVaZn2X37SgtiuUMbg,0x0000000000000000000000000000000000000000,0x0000000000000000000000000000000000000000,0x726f757465723134686a32746176713866706573647778786375343472747933686839307668756a7276636d73746c347a723374786d667677397330307a74766b,2494104990,50000
```

### Generate ABIs, BIN and GO bindings

```sh
cd evm
yarn install
sh scripts/createBinding.sh
```

## Contract Overview

### Roles

- `DEFAULT_ADMIN_ROLE`: This role has full administrative control over the contract. It is granted to the contract deployer.
- `RESOURCE_SETTER`: Addresses with this role can update certain contract parameters, such as gatewayContract and routerMiddlewareBase.
- `PAUSER`: Addresses with this role can pause and unpause the contract.

### Asset Forwarder Entry Points

**`iSend`** : Initiates token deposits on the source chain, forwarder will take care afterwards

```ts
function iSend(
    uint256 partnerId,
    bytes32 destChainIdBytes,
    bytes calldata recipient,
    address srcToken,
    uint256 amount,
    uint256 destAmount
) external payable
```

**`iRelay`** : Forwarder will transfer funds to recipient which was deposited at src chain

```
function iRelay(RelayData memory relayData) external payable
```

**`iReceive`** : Middleware contract sends forwarder amount release to src chain once forwarder claims funda, called via gateway

```
function iReceive(string calldata requestSender, bytes memory packet, string calldata) external returns (bytes memory)
```
