# sh deploy/deployERC20Token.sh Network ENV
# sh deploy/deployERC20Token.sh SEPOLIA TESTNET

# Check if the necessary parameters are provided
if [ 2 -gt "$#" ]; then
    echo "Usage: sh deploy/deployERC20Token.sh <Testnet> <env>"
    exit 1
fi

json=$(cat config.json)

export $(jq -r "to_entries|map(\"\(.key)=\(.value|tostring)\")|.[]" <<< "$json")

NETWORK=$1
ENV=$2
VERIFY=$3

RPC=${NETWORK}
RPC+=_RPC

PRIVATE_KEY=${ENV}
PRIVATE_KEY+="_PRIVATE_KEY"

ETHERSCAN_API_KEY=${NETWORK}
ETHERSCAN_API_KEY+="_ETHERSCAN_API_KEY"

echo $RPC
rpc="${!RPC}"
privateKey="${!PRIVATE_KEY}"
etherscanApiKey="${!ETHERSCAN_API_KEY}"

if [ "$rpc" = "" ]; then
    echo "Please Provide Non-Emptry RPC values"
    exit 1
fi
if [ "$privateKey" = "" ]; then
    echo "Please Provide Non-Emptry privateKey"
    exit 1
fi
 if [ "$etherscanApiKey" = "" ]; then
    echo "Please Provide Non-Emptry values"
    exit 1
fi

if [ -z "$VERIFY" ]; then
  echo "Running Deployment Command with Verification"
  forge create --rpc-url ${rpc} --private-key ${privateKey} contracts/dexspan/FetchLiquidity.sol:FetchLiquidity \
    --etherscan-api-key ${etherscanApiKey} --verify  --legacy
else
  echo "Running Deployment Command without Verification"
  forge create --rpc-url ${rpc} --private-key ${privateKey} contracts/dexspan/FetchLiquidity.sol:FetchLiquidity \
    --legacy
fi
