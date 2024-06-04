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

NAME="Testing Token"
SYMBOL="TT"
DECIMAL=18

MINTER=0x2CFF527bf0d0D51d6A15B445d3e3F6BC9aea5ac5

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
  forge create --rpc-url ${rpc} --private-key ${privateKey} contracts/ERC20Token.sol:ERC20Token \
    --constructor-args  "${NAME}" "${SYMBOL}" "${DECIMAL}" "${MINTER}" --etherscan-api-key ${etherscanApiKey} --verify
else
  echo "Running Deployment Command without Verification"
  forge create --rpc-url ${rpc} --private-key ${privateKey} contracts/ERC20Token.sol:ERC20Token \
    --constructor-args  "${NAME}" "${SYMBOL}" "${DECIMAL}" "${MINTER}" --legacy
fi
