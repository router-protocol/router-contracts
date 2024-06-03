const dotenv = require("dotenv");
dotenv.config();

const port = process.env.HOST_PORT || 9090;
module.exports = {
    networks: {
        mainnet: {
            privateKey: process.env.TRON_PRIVATE_KEY_MAINNET,
            userFeePercentage: 100,
            feeLimit: 15000 * 1e6,
            fullHost: "https://api.trongrid.io",
            network_id: "1",
            timeout: 60000000
        },
        shasta: {
            privateKey: process.env.PRIVATE_KEY_SHASTA,
            userFeePercentage: 100,
            feeLimit: 15000 * 1e6,
            fullHost: "https://api.shasta.trongrid.io",
            network_id: "2",
            timeout: 60000000
        },
        nile: {
            privateKey: process.env.PRIVATE_KEY_NILE,
            userFeePercentage: 100,
            feeLimit: 15000 * 1e6,
            fullHost: "https://api.nileex.io",
            network_id: "3",
            timeout: 60000000
        },
        development: {
            privateKey: "0000000000000000000000000000000000000000000000000000000000000001",
            userFeePercentage: 100,
            feeLimit: 1000 * 1e6,
            fullHost: "http://127.0.0.1:" + port,
            network_id: "9",
            timeout: 60000000
        },
        compilers: {
            solc: {
                version: "0.8.18"
            }
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 100000000
        },
        evmVersion: 'london'
    }
};
