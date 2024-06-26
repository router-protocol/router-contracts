#!/usr/bin/env node

const fs = require("fs");
const rimraf = require("rimraf");

const BUILD_PATH = "./build/bindings/";
const ABI_PATH = BUILD_PATH + "abi/";
const CONTRACT_PATH = "build/contracts/";
const BIN_PATH = BUILD_PATH + "bin/";

// Loop through all the files in the temp directory
fs.readdir("./artifacts/contracts", function (err, files) {
    if (err) {
        console.error("Could not list the directory.", err);
        process.exit(1);
    }

    // Remove old build
    rimraf.sync(BUILD_PATH);

    // Create empty dirs
    fs.mkdirSync(BUILD_PATH, { recursive: true });
    if (!fs.existsSync(ABI_PATH)) {
        fs.mkdirSync(ABI_PATH);
    }
    if (!fs.existsSync(BIN_PATH)) {
        fs.mkdirSync(BIN_PATH);
    }
    if (!fs.existsSync(CONTRACT_PATH)) {
        fs.mkdirSync(CONTRACT_PATH);
    }

    files.forEach(function (file, index) {
        const basename = file.split(".")[0];
        if (file.split(".")[1] == "sol") {
            const path = "./artifacts/contracts/" + file + "/" + basename + ".json";
            let rawdata = fs.readFileSync(path);
            let contract = JSON.parse(rawdata);
            let { abi, bytecode } = contract;
            bytecode = bytecode.substring(2);

            if (abi.length === 0) return;
            fs.writeFileSync(ABI_PATH + basename + ".abi", JSON.stringify(abi));
            fs.writeFileSync(BIN_PATH + basename + ".bin", bytecode);
            fs.writeFileSync(CONTRACT_PATH + basename + ".json", JSON.stringify({ "abi": abi, "bytecode": bytecode }));

        }
    });
});
