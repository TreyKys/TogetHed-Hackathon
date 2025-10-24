const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require('firebase-functions/params');
const {
  Client,
  PrivateKey,
  AccountCreateTransaction,
  Hbar,
  PublicKey,
  AccountId
} = require("@hashgraph/sdk");
const cors = require("cors")({ origin: true });
const ethers = require("ethers");

// Define secrets
const hederaAdminAccountId = defineSecret('HEDERA_ADMIN_ACCOUNT_ID');
const hederaAdminPrivateKey = defineSecret('HEDERA_ADMIN_PRIVATE_KEY');

// --- Configuration ---
const assetTokenContractId = "0.0.48553257"; // EVM: 0xD46d08Ae4A7bF06B56f950b406b7C8eFC05236cD
const assetTokenABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"owner","type":"address"}],"name":"ERC721IncorrectOwner","type":"error"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ERC721InsufficientApproval","type":"error"},{"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC721InvalidApprover","type":"error"},{"inputs":[{"internalType":"address","name":"operator","type":"address"}],"name":"ERC721InvalidOperator","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"ERC721InvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC721InvalidReceiver","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC721InvalidSender","type":"error"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ERC721NonexistentToken","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"assetData","outputs":[{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getAssetData","outputs":[{"components":[{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"internalType":"struct AssetToken.AssetData","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"name":"safeMint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];

// Utility: Validate EVM address (no ENS, no malformed)
function isValidEvmAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Utility: Convert Hedera AccountId to EVM address
function toEvmAddress(accountIdString) {
  if (isValidEvmAddress(accountIdString)) {
    return accountIdString;
  }
  try {
    // The SDK returns an address WITHOUT the 0x prefix, which our validation function needs.
    return `0x${AccountId.fromString(accountIdString).toSolidityAddress()}`;
  } catch (e) {
    return null;
  }
}

exports.createAccount = onRequest({ secrets: [hederaAdminAccountId, hederaAdminPrivateKey] }, (request, response) => {
  cors(request, response, async () => {
    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }
    try {
      const { publicKey } = request.body;
      if (!publicKey) {
        throw new Error("Public key is required in the request body.");
      }

      const adminAccountId = hederaAdminAccountId.value();
      const rawAdminPrivateKey = hederaAdminPrivateKey.value();

      if (!adminAccountId || !rawAdminPrivateKey) {
        throw new Error("Admin credentials are not set as secrets in this V2 function environment.");
      }

      const adminPrivateKey = PrivateKey.fromStringECDSA(rawAdminPrivateKey);

      const client = Client.forTestnet();
      client.setOperator(adminAccountId, adminPrivateKey);

      const transaction = new AccountCreateTransaction()
        .setKey(PublicKey.fromString(publicKey))
        .setInitialBalance(new Hbar(10));
      const txResponse = await transaction.execute(client);
      const receipt = await txResponse.getReceipt(client);
      const newAccountId = receipt.accountId;
      if (!newAccountId) {
        throw new Error("Hedera network failed to return a new account ID.");
      }
      console.log("SUCCESS: New account created ->", newAccountId.toString());
      return response.status(200).send({ accountId: newAccountId.toString() });
    } catch (error) {
      console.error("FATAL ERROR in createAccount function:", error);
      return response.status(500).send({ error: error.message });
    }
  });
});

async function getTokenIdFromMirrorNode(txHash) {
    const maxRetries = 10;
    const retryDelay = 3000; // 3 seconds
    const txId = txHash.startsWith('0x') ? txHash.substring(2) : txHash;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const url = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${txId}`;
            const response = await fetch(url);
            if (response.status === 200) {
                const data = await response.json();
                if (data.transactions && data.transactions.length > 0) {
                    const txDetails = data.transactions[0];
                    if (txDetails.nft_transfers && txDetails.nft_transfers.length > 0) {
                        // Find the transfer where the sender is the zero address (a mint operation)
                        const mintTransfer = txDetails.nft_transfers.find(t => t.sender_account_id === '0.0.0');
                        if (mintTransfer) {
                            return mintTransfer.serial_number.toString();
                        }
                    }
                }
            }
        } catch (e) {
            console.warn(`(Attempt ${i + 1}/${maxRetries}) Mirror node lookup failed: ${e.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    return null;
}

exports.mintRWAviaUSSD = onRequest({ secrets: [hederaAdminAccountId, hederaAdminPrivateKey] }, (request, response) => {
  cors(request, response, async () => {
    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }
    try {
      const { accountId, assetType, quality, location } = request.body;
      if (!accountId || !assetType || !quality || !location) {
        throw new Error("Missing required fields: accountId, assetType, quality, location.");
      }
      const rawAdminPrivateKey = hederaAdminPrivateKey.value();
      if (!rawAdminPrivateKey) {
        throw new Error("Admin private key is not set as a secret in this V2 function environment.");
      }

      // --- Ethers.js Setup ---
      const hederaTestnet = {
        name: "Hedera Testnet",
        chainId: 296,
        ensAddress: null, // Hedera does not support ENS
      };
      const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api", hederaTestnet);
      const adminWallet = new ethers.Wallet(`0x${rawAdminPrivateKey}`, provider);

      // Convert contract and user account to EVM addresses
      const assetTokenAddress = toEvmAddress(assetTokenContractId);
      if (!assetTokenAddress) {
        throw new Error("Invalid assetTokenContractId format.");
      }
      const userEvmAddress = toEvmAddress(accountId);
      if (!userEvmAddress) {
        throw new Error("Invalid accountId format. Must be a valid Hedera AccountId.");
      }
      if (!isValidEvmAddress(userEvmAddress)) {
        throw new Error("User EVM address is invalid. ENS names are not supported on Hedera.");
      }

      const assetToken = new ethers.Contract(assetTokenAddress, assetTokenABI, adminWallet);

      // --- Minting Logic ---
      let tx, receipt;
      try {
        // Estimate gas and add a 20% buffer
        const estimatedGas = await assetToken.safeMint.estimateGas(
          userEvmAddress, assetType, quality, location
        );
        const gasLimit = Math.ceil(Number(estimatedGas) * 1.2);

        tx = await assetToken.safeMint(
          userEvmAddress,
          assetType,
          quality,
          location,
          { gasLimit }
        );
        receipt = await tx.wait();
      } catch (err) {
        if (err.code === "UNSUPPORTED_OPERATION" && err.operation === "getEnsAddress") {
          throw new Error("ENS is not supported on Hedera. Use a direct EVM address.");
        }
        if (err.code === "INSUFFICIENT_GAS") {
          throw new Error("Transaction failed due to insufficient gas. Please try again with a higher gas limit.");
        }
        throw err;
      }

      // --- Mirror Node Polling for Token ID ---
      const mintedTokenId = await getTokenIdFromMirrorNode(receipt.hash);
      if (!mintedTokenId) {
          throw new Error("Could not retrieve minted token ID from the mirror node.");
      }

      console.log(`SUCCESS: RWA minted for user ${accountId}. New Token ID: ${mintedTokenId}.`);
      return response.status(200).send({
        tokenId: mintedTokenId,
        assetTokenId: assetTokenContractId,
        transactionHash: receipt.hash
      });

    } catch (error) {
      // Handle common Hedera errors with actionable messages
      if (error.message && error.message.includes("ACCOUNT_KYC_NOT_GRANTED_FOR_TOKEN")) {
        return response.status(400).send({ error: "User account must be KYC'd and associated with the token before minting." });
      }
      if (error.message && error.message.includes("INVALID_SIGNATURE")) {
        return response.status(400).send({ error: "Invalid signature. Check admin credentials." });
      }
      if (error.message && error.message.includes("INVALID_CONTRACT_ID")) {
        return response.status(400).send({ error: "Invalid contract address. Check assetTokenContractId." });
      }
      if (error.message && error.message.includes("INSUFFICIENT_TX_FEE")) {
        return response.status(400).send({ error: "Insufficient transaction fee. Try increasing the gas limit or check your account balance." });
      }
      if (error.message && (error.message.includes("WRONG_NONCE") || error.message.includes("nonce"))) {
        return response.status(400).send({ error: "Nonce error. Please retry the transaction or check for pending transactions." });
      }
      console.error("ERROR minting RWA via USSD:", error);
      return response.status(500).send({ error: error.message });
    }
  });
});
