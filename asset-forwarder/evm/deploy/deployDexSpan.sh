# sh deploy/deployDexSpan.sh Network ENV
# sh deploy/deployDexSpan.sh SEPOLIA TESTNET

# Check if the necessary parameters are provided
if [ 2 -gt "$#" ]; then
    echo "Usage: sh deploy/deployDexSpan.sh <Testnet> <env>"
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


ASSET_FORWARDER_ADDRESS="0xc21e4ebd1d92036cb467b53fe3258f219d909eb9"
NATIVE="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
WRAPPED_NATIVE="0x71802e8F394BB9d05a1b8E9d0562917609FD7325"
UNI_V2_SKIM_ADDRESS="0xB1b64005B11350a94c4D069eff4215592d98F2E2"

rpc="${!RPC}"
privateKey="${!PRIVATE_KEY}"
etherscanApiKey="${!ETHERSCAN_API_KEY}"

if [ "$rpc" = "" ]; then
    echo "Please Provide Non-Empty RPC values"
    exit 1
fi
if [ "$privateKey" = "" ]; then
    echo "Please Provide Non-Empty privateKey"
    exit 1
fi
 if [ "$etherscanApiKey" = "" ]; then
    echo "Please Provide Non-Empty values"
    exit 1
fi

if [ -z "$VERIFY" ]; then
  echo "Running Deployment Command with Verification"
  forge create --rpc-url ${rpc} --private-key ${privateKey} contracts/dexspan/DexSpan.sol:DexSpan \
    --constructor-args  "${ASSET_FORWARDER_ADDRESS}" "${NATIVE}" "${WRAPPED_NATIVE}" "${UNI_V2_SKIM_ADDRESS}" --etherscan-api-key ${etherscanApiKey} --verify  --legacy
else
  echo "Running Deployment Command without Verification"
  forge create --rpc-url ${rpc} --private-key ${privateKey} contracts/dexspan/DexSpan.sol:DexSpan \
    --constructor-args  "${ASSET_FORWARDER_ADDRESS}" "${NATIVE}" "${WRAPPED_NATIVE}" "${UNI_V2_SKIM_ADDRESS}" --legacy
fi
