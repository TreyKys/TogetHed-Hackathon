
const { AccountId } = require("@hashgraph/sdk");

const evmAddress = "0x5FE7C5de2e343E2C25ea6e035213534751FB57F8";

// The fromSolidityAddress() method is the correct way to perform this conversion.
const accountId = AccountId.fromSolidityAddress(evmAddress);

console.log(`EVM Address: ${evmAddress}`);
console.log(`Hedera Account ID: ${accountId.toString()}`);
