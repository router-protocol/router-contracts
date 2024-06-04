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

GATEWAY="0x4b7ff2fae6b514a7943d360e01790dc1dfaf6736"
ROUTER_MIDDLEWARE_BASE="0x726f757465723134686a32746176713866706573647778786375343472747933686839307668756a7276636d73746c347a723374786d667677397330307a74766b"
MIN_GAS_THRESOLD=75000
DEPOSIT_NONCE=0

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
  forge create --rpc-url ${rpc} --private-key ${privateKey} contracts/AssetForwarder.sol:AssetForwarder \
    --constructor-args  "${GATEWAY}" "${ROUTER_MIDDLEWARE_BASE}" "${MIN_GAS_THRESOLD}" "${DEPOSIT_NONCE}" --etherscan-api-key ${etherscanApiKey} --verify
else
  echo "Running Deployment Command without Verification"
  forge create --rpc-url ${rpc} --private-key ${privateKey} contracts/ERC20Token.sol:ERC20Token \
    --constructor-args  "${GATEWAY}" "${ROUTER_MIDDLEWARE_BASE}" "${MIN_GAS_THRESOLD}" "${DEPOSIT_NONCE}" --legacy
fi
