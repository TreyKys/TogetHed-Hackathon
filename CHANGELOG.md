### `CHANGELOG.md`
#### **Entry: 2025-10-14**
**`feat(testing)`: Add End-to-End Smart Contract Test**

**1. Goal:**
   - To conduct the first live, end-to-end test of the frontend's ability to call the `Escrow` smart contract on the Hedera Testnet.

**2. Changes Made:**
   - **Integrated `ethers.js`:** The `ethers.js` library was integrated with the existing `WalletConnect` setup in `App.jsx` to create a provider and signer when a user's wallet is connected.
   - **Added Test UI:** A minimal UI was implemented in `App.jsx` specifically for this test, featuring a "Connect Wallet" button and a "Create Test Gig" button.
   - **Implemented Contract Call:** A new function, `handleCreateTestGig`, was added to call the `createGig` function on the smart contract, passing the required parameters and handling the transaction lifecycle (sending, waiting for confirmation, and displaying status).

**3. Status:**
   - The application now has a functional end-to-end test capability. Users can connect their wallet and send a live transaction to the smart contract, verifying the full connection from the UI to the blockchain.
