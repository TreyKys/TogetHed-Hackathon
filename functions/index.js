const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require('firebase-functions/params');
const {
  Client,
  PrivateKey,
  AccountCreateTransaction,
  Hbar,
  PublicKey,
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters
} = require("@hashgraph/sdk");
const ethers =require("ethers");

// --- Define Secrets ---
const hederaAdminAccountId = defineSecret('HEDERA_ADMIN_ACCOUNT_ID');
const hederaAdminPrivateKey = defineSecret('HEDERA_ADMIN_PRIVATE_KEY');

// --- CORS Configuration ---
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174", "https://integro-hed.netlify.app"],
  optionsSuccessStatus: 200 // For legacy browser support
};

// --- Smart Contract Configuration ---
const assetTokenContractId = "0.0.48553257";
const assetTokenABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"owner","type":"address"}],"name":"ERC721IncorrectOwner","type":"error"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ERC721InsufficientApproval","type":"error"},{"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC721InvalidApprover","type":"error"},{"inputs":[{"internalType":"address","name":"operator","type":"address"}],"name":"ERC721InvalidOperator","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"ERC721InvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC721InvalidReceiver","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC721InvalidSender","type":"error"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ERC721NonexistentToken","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"assetData","outputs":[{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getAssetData","outputs":[{"components":[{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"internalType":"struct AssetToken.AssetData","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"name":"safeMint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];

// --- Utility Functions ---
function isValidEvmAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function toEvmAddress(accountIdString) {
  if (isValidEvmAddress(accountIdString)) return accountIdString;
  try {
    return `0x${AccountId.fromString(accountIdString).toSolidityAddress()}`;
  } catch (e) {
    return null;
  }
}

async function getTokenIdFromMirrorNode(txId) {
    const maxRetries = 20;
    const retryDelay = 3000;
    const formattedTxId = txId.replace(/@/g, '-').replace(/\./g, '-');
    console.log(`Starting mirror node poll for transaction ID: ${txId} (formatted as ${formattedTxId})`);
    for (let i = 0; i < maxRetries; i++) {
        try {
            const url = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${formattedTxId}`;
            console.log(`(Attempt ${i + 1}/${maxRetries}) Polling URL: ${url}`);
            const response = await fetch(url);
            if (response.status === 200) {
                const data = await response.json();
                console.log(`(Attempt ${i + 1}) Received 200 OK. Data:`, JSON.stringify(data, null, 2));
                if (data.transactions && data.transactions.length > 0) {
                    const txDetails = data.transactions[0];
                    const mintTransfer = txDetails.nft_transfers?.find(t => t.sender_account_id === '0.0.0');
                    if (mintTransfer) {
                        console.log(`Found mint transfer in mirror node. Serial number: ${mintTransfer.serial_number}`);
                        return mintTransfer.serial_number.toString();
                    }
                }
            } else {
                console.warn(`(Attempt ${i + 1}) Mirror node returned status: ${response.status}`);
            }
        } catch (e) {
            console.error(`(Attempt ${i + 1}/${maxRetries}) Mirror node lookup threw an error: ${e.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    console.error(`Polling timed out. Could not find token ID via mirror node.`);
    return null;
}

// --- Cloud Functions ---

exports.createAccount = onRequest(
  { secrets: [hederaAdminAccountId, hederaAdminPrivateKey], cors: corsOptions },
  async (request, response) => {
    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }
    try {
      const { publicKey } = request.body;
      if (!publicKey) {
        throw new Error("Public key is required.");
      }
      const adminAccountId = hederaAdminAccountId.value();
      const rawAdminPrivateKey = hederaAdminPrivateKey.value();
      if (!adminAccountId || !rawAdminPrivateKey) {
        throw new Error("Admin credentials are not configured.");
      }
      const adminPrivateKey = PrivateKey.fromStringECDSA(rawAdminPrivateKey);
      const client = Client.forTestnet().setOperator(adminAccountId, adminPrivateKey);
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
      console.error("FATAL ERROR in createAccount:", error);
      return response.status(500).send({ error: error.message });
    }
  }
);

exports.mintRWAviaUSSD = onRequest(
  { secrets: [hederaAdminAccountId, hederaAdminPrivateKey], cors: corsOptions },
  async (request, response) => {
    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }
    try {
      const { accountId, assetType, quality, location } = request.body;
      if (!accountId || !assetType || !quality || !location) {
        throw new Error("Missing required fields.");
      }
      const adminAccountId = hederaAdminAccountId.value();
      const rawAdminPrivateKey = hederaAdminPrivateKey.value();
      if (!rawAdminPrivateKey || !adminAccountId) {
        throw new Error("Admin credentials are not configured.");
      }
      const adminPrivateKey = PrivateKey.fromStringECDSA(rawAdminPrivateKey);
      const client = Client.forTestnet().setOperator(adminAccountId, adminPrivateKey);
      const userEvmAddress = toEvmAddress(accountId);
      if (!userEvmAddress || !isValidEvmAddress(userEvmAddress)) {
        throw new Error("Invalid user accountId format.");
      }
      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(assetTokenContractId)
        .setGas(1_000_000)
        .setFunction("safeMint", new ContractFunctionParameters()
            .addAddress(userEvmAddress)
            .addString(assetType)
            .addString(quality)
            .addString(location)
        );
      const txResponse = await contractExecuteTx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      let mintedTokenId;
      if (receipt.serials && receipt.serials.length > 0) {
        mintedTokenId = receipt.serials[0].toString();
        console.log("Successfully extracted serial number from receipt.");
      } else {
        console.warn("Receipt did not contain serials. Polling mirror node...");
        const txId = txResponse.transactionId.toString();
        mintedTokenId = await getTokenIdFromMirrorNode(txId);
        if (!mintedTokenId) {
            console.error("Full Hedera Receipt:", JSON.stringify(receipt, null, 2));
            throw new Error("Could not retrieve minted token ID from receipt or mirror node.");
        }
      }
      console.log(`SUCCESS: RWA minted for ${accountId}. Token ID: ${mintedTokenId}.`);
      return response.status(200).send({
        tokenId: mintedTokenId,
        assetTokenId: assetTokenContractId,
        transactionHash: txResponse.transactionHash.toString('hex')
      });
    } catch (error) {
      console.error("ERROR minting RWA:", error);
      return response.status(500).send({ error: error.message });
    }
  }
);
