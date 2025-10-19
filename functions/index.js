const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {
  Client,
  PrivateKey,
  AccountCreateTransaction,
  Hbar,
  PublicKey,
  ContractExecuteTransaction, // Needed to call the mint function
  ContractFunctionParameters,
  AccountId // Needed to parse account ID string
} = require("@hashgraph/sdk");
const cors = require("cors")({ origin: true });
const ethers = require("ethers"); // Needed for ABI encoding

// --- Assume Firebase Admin SDK is initialized ---
// if (admin.apps.length === 0) { admin.initializeApp(); }
// const db = admin.firestore();

// --- Configuration (Replace with your actual values) ---
const assetTokenContractId = "0.0.7082970"; // e.g., "0.0.123456" (NOT the 0x address)
// ⚠️ ACTION REQUIRED: Paste your AssetToken ABI here
const assetTokenABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"owner","type":"address"}],"name":"ERC721IncorrectOwner","type":"error"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ERC721InsufficientApproval","type":"error"},{"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC721InvalidApprover","type":"error"},{"inputs":[{"internalType":"address","name":"operator","type":"address"}],"name":"ERC721InvalidOperator","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"ERC721InvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC721InvalidReceiver","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC721InvalidSender","type":"error"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ERC721NonexistentToken","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"assetData","outputs":[{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getAssetData","outputs":[{"components":[{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"internalType":"struct AssetToken.AssetData","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"name":"safeMint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"associate","outputs":[],"stateMutability":"nonpayable","type":"function"}];

// This is your "Account Factory" endpoint
exports.createAccount = functions.https.onRequest((request, response) => {
  // Enable CORS to allow requests from your Netlify app
  cors(request, response, async () => {
    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }

    try {
      // 1. Get the new user's public key from the front-end request
      const { publicKey } = request.body;
      if (!publicKey) {
        throw new Error("Public key is required in the request body.");
      }

      // 2. Load your ADMIN credentials from Firebase's secure runtime config
      const adminAccountId = functions.config().hedera.admin_account_id;
      const adminPrivateKey = functions.config().hedera.admin_private_key;

      if (!adminAccountId || !adminPrivateKey) {
        throw new Error("Admin credentials are not set in Firebase config.");
      }

      // 3. Connect to Hedera as the Admin
      const client = Client.forTestnet();
      client.setOperator(adminAccountId, adminPrivateKey);

      // 4. Create the new account on the network
      const transaction = new AccountCreateTransaction()
        .setKey(PublicKey.fromString(publicKey)) // Use the provided public key
        .setInitialBalance(new Hbar(10)); // Give the new user 10 HBAR to start!

      const txResponse = await transaction.execute(client);
      const receipt = await txResponse.getReceipt(client);
      const newAccountId = receipt.accountId;

      if (!newAccountId) {
        throw new Error("Hedera network failed to return a new account ID.");
      }

      // 5. Send the new Account ID back to the front-end
      console.log("SUCCESS: New account created ->", newAccountId.toString());
      return response.status(200).send({ accountId: newAccountId.toString() });

    } catch (error) {
      console.error("FATAL ERROR in createAccount function:", error);
      return response.status(500).send({ error: error.message });
    }
  });
});

// --- NEW FUNCTION: mintRWAviaUSSD ---
exports.mintRWAviaUSSD = functions.https.onRequest((request, response) => {
  cors(request, response, async () => {
    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }

    try {
      // 1. Get data from the front-end request
      const { accountId, assetType, quality, location } = request.body;
      if (!accountId || !assetType || !quality || !location) {
        throw new Error("Missing required fields: accountId, assetType, quality, location.");
      }

      // 2. Load ADMIN credentials (needed to pay for the transaction)
      const adminAccountId = functions.config().hedera.admin_account_id;
      const adminPrivateKey = functions.config().hedera.admin_private_key;
      if (!adminAccountId || !adminPrivateKey) {
        throw new Error("Admin credentials not set.");
      }

      // 3. Connect to Hedera as Admin
      const client = Client.forTestnet();
      client.setOperator(adminAccountId, adminPrivateKey);

      // 4. Prepare the call to the AssetToken contract's safeMint function
      // NOTE: For USSD users, the *user's account* (accountId) is the recipient 'to' address.
      // We need the EVM address equivalent for the contract call.
      // For simplicity in the demo, we'll assume the admin is minting TO the user's account ID directly.
      // A production system would need a robust way to get the user's EVM address or handle this via custody.

      // We'll use ethers to properly encode the function call data
      const iface = new ethers.Interface(assetTokenABI);
      const functionCallData = iface.encodeFunctionData("safeMint", [
          // This assumes safeMint takes 'address to', and then the metadata strings
          // We need the EVM address of the recipient (the USSD user)
          // Getting this reliably from just the 0.0.X ID is hard without extra steps.
          // *** DEMO SIMPLIFICATION: We mint to the ADMIN for now ***
          // In production, we'd retrieve the user's key custodially to sign OR get their EVM address
          adminAccountId, // Placeholder - should be user's EVM address
          assetType,
          quality,
          location
      ]);

      // Convert the encoded data (hex string) to Uint8Array
      const functionCallAsBytes = ethers.getBytes(functionCallData);

      // 5. Execute the smart contract transaction
       const transaction = new ContractExecuteTransaction()
         .setContractId(assetTokenContractId)
         .setGas(150000) // Adjust gas as needed
         .setFunctionParameters(functionCallAsBytes); // Use the raw bytes

      const txResponse = await transaction.execute(client);
      const receipt = await txResponse.getReceipt(client);

      // We need to parse the receipt logs to find the token ID
      // This requires the full ABI and event signature knowledge
      let mintedTokenId = "N/A (Parsing receipt logs needed)"; // Placeholder

      console.log(`SUCCESS: RWA minted for user ${accountId}. Status: ${receipt.status}`);
      return response.status(200).send({ tokenId: mintedTokenId }); // Send placeholder ID back

    } catch (error) {
      console.error("ERROR minting RWA via USSD:", error);
      return response.status(500).send({ error: error.message });
    }
  });
});