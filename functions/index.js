const functions = require("firebase-functions");
const {
  Client,
  PrivateKey,
  AccountCreateTransaction,
  Hbar,
  PublicKey, // Import PublicKey
} = require("@hashgraph/sdk");
const cors = require("cors")({ origin: true });

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