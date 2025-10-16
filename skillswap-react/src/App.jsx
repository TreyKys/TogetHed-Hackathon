import { useEffect, useState } from "react";
import './App.css';

// Our working WalletConnect imports + transaction imports
import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import { 
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  AccountId,
  Hbar
} from "@hashgraph/sdk";

// Import our contract address
import { escrowContractAddress } from "./hedera.js";

const projectId = "2798ba475f686a8e0ec83cc2cceb095b";

function App() {
  const [accountId, setAccountId] = useState(null);
  const [status, setStatus] = useState("Initializing WalletConnect...");
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const [signClient, setSignClient] = useState(null);
  const [modal, setModal] = useState(null);

  // This effect runs once on component mount - OUR PROVEN WORKING INITIALIZATION
  useEffect(() => {
    async function initialize() {
      try {
        // Initialize the SignClient (the "engine")
        const client = await SignClient.init({
          projectId: projectId,
          metadata: {
            name: "Integro Marketplace",
            description: "A skill marketplace on Hedera",
            url: window.location.origin,
            icons: [],
          },
        });
        
        // Initialize the Modal (the "UI")
        const wcModal = new WalletConnectModal({
          projectId: projectId,
          chains: ["hedera:testnet"], // Specify the Hedera testnet
        });

        // Set up event listener for successful connection
        client.on("session_connect", (event) => {
          const connectedAccountId = event.params.namespaces.hedera.accounts[0].split(':')[2];
          setAccountId(connectedAccountId);
          setStatus(`✅ Connected as: ${connectedAccountId}`);
        });

        // Check for existing sessions
        if (client.session.length > 0) {
          const lastSession = client.session.get(client.session.keys.at(-1));
          const existingAccountId = lastSession.namespaces.hedera.accounts[0].split(':')[2];
          setAccountId(existingAccountId);
          setStatus(`✅ Connected as: ${existingAccountId}`);
        }

        setSignClient(client);
        setModal(wcModal);
        setStatus("Ready to connect");
        setIsLoading(false);

      } catch (error) {
        console.error("Initialization failed:", error);
        setStatus(`❌ Initialization error: ${error.message}`);
        setIsLoading(false);
      }
    }
    initialize();
  }, []);

  // The connect function that performs the handshake - OUR PROVEN WORKING CONNECTION
  const handleConnect = async () => {
    if (!signClient || !modal) {
      setStatus("❌ Connector not ready. Please refresh.");
      return;
    }
    setIsLoading(true);
    setStatus("🔄 Requesting session from server...");

    try {
      // Perform the handshake with the WalletConnect server
      const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
          hedera: {
            methods: ["hedera_signMessage", "hedera_signAndExecuteTransaction"],
            chains: ["hedera:testnet"],
            events: ["chainChanged", "accountsChanged"],
          },
        },
      });

      // Open the modal with the REAL, VALID URI
      if (uri) {
        setStatus("✅ URI generated! Please scan with HashPack.");
        await modal.openModal({ uri });
        // The modal is now open, waiting for user to scan.
        // The `session_connect` event will fire when they approve in the wallet.
        await approval(); // Wait for the session to be approved
        modal.closeModal();
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setStatus(`❌ Connection Failed or Rejected.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (signClient && signClient.session.length > 0) {
      const lastSession = signClient.session.get(signClient.session.keys.at(-1));
      await signClient.disconnect({
        topic: lastSession.topic,
        reason: { code: 6000, message: "User disconnected." },
      });
      setAccountId(null);
      setStatus("Ready to connect");
    }
  };

  // *** COMPREHENSIVE ERROR HANDLING VERSION ***
  const handleCreateTestGig = async () => {
    if (!signClient || !accountId) {
      alert("Please connect wallet first.");
      return;
    }

    setIsTransactionLoading(true);
    setStatus("🚀 Starting transaction...");
    
    try {
      // Step 1: Get the active session with validation
      const sessionKeys = Array.from(signClient.session.keys);
      console.log("Session keys:", sessionKeys);
      
      if (sessionKeys.length === 0) {
        throw new Error("No active session found. Please reconnect your wallet.");
      }
      
      const session = signClient.session.get(sessionKeys[0]);
      console.log("Active session:", session);
      
      if (!session || !session.topic) {
        throw new Error("Invalid session. Please reconnect your wallet.");
      }

      setStatus("📝 Validating contract address...");

      // Step 2: Prepare contract ID with detailed validation
      let contractId;
      let contractAddressString;
      
      if (typeof escrowContractAddress === 'string') {
        contractAddressString = escrowContractAddress;
        console.log("Contract address (string):", contractAddressString);
        
        if (contractAddressString.startsWith('0x')) {
          const addressWithoutPrefix = contractAddressString.slice(2);
          console.log("EVM address without prefix:", addressWithoutPrefix);
          
          if (addressWithoutPrefix.length !== 40) {
            throw new Error(`Invalid EVM address length: ${addressWithoutPrefix.length} characters (expected 40)`);
          }
          
          contractId = ContractId.fromEvmAddress(0, 0, addressWithoutPrefix);
          console.log("Created ContractId from EVM address:", contractId.toString());
        } else if (contractAddressString.startsWith('0.0.')) {
          contractId = ContractId.fromString(contractAddressString);
          console.log("Created ContractId from Hedera format:", contractId.toString());
        } else {
          throw new Error(`Invalid contract address format: "${contractAddressString}". Must start with 0x (EVM) or 0.0. (Hedera)`);
        }
      } else {
        contractId = escrowContractAddress;
        contractAddressString = contractId.toString();
        console.log("ContractId object:", contractAddressString);
      }

      // Step 3: Convert user account to EVM address
      console.log("User account ID:", accountId);
      const userAccountId = AccountId.fromString(accountId);
      const userEvmAddress = userAccountId.toSolidityAddress();
      console.log("User EVM address:", userEvmAddress);

      if (userEvmAddress.length !== 40) {
        throw new Error(`Invalid user EVM address: "${userEvmAddress}" (length: ${userEvmAddress.length}, expected 40)`);
      }

      setStatus("🔨 Building transaction...");

      // Step 4: Create the transaction
      const transaction = new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(1000000) // Very generous gas
        .setMaxTransactionFee(new Hbar(10)) // Generous fee
        .setFunction("createGig", new ContractFunctionParameters()
          .addAddress(userEvmAddress)
          .addUint256(100000000) // 1 HBAR in tinybars
        );

      console.log("Transaction built:", transaction);

      setStatus("📤 Converting to bytes...");

      // Step 5: Convert to bytes
      const transactionBytes = await transaction.toBytes();
      console.log("Transaction bytes length:", transactionBytes.length);

      setStatus("⏳ Sending to HashPack...");

      // Step 6: Send through WalletConnect with timeout
      const requestPromise = signClient.request({
        topic: session.topic,
        chainId: "hedera:testnet",
        request: {
          method: "hedera_signAndExecuteTransaction",
          params: {
            transaction: transactionBytes
          }
        }
      });

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout - wallet didn't respond")), 30000);
      });

      const result = await Promise.race([requestPromise, timeoutPromise]);
      console.log("Wallet response:", result);

      // Step 7: Handle response
      if (!result) {
        throw new Error("No response received from wallet");
      }

      if (result.transactionId) {
        setStatus("✅ Test Gig created successfully!");
        alert(`🎉 Success! Transaction ID: ${result.transactionId}`);
      } else if (result.id) {
        setStatus("✅ Transaction submitted!");
        alert(`Transaction submitted! ID: ${result.id}`);
      } else if (result.hash) {
        setStatus("✅ Transaction submitted!");
        alert(`Transaction submitted! Hash: ${result.hash}`);
      } else {
        setStatus("✅ Transaction sent to network!");
        alert("Transaction submitted! Please check your wallet for confirmation.");
      }

    } catch (error) {
      // COMPREHENSIVE ERROR HANDLING
      console.error("FULL TRANSACTION ERROR:", error);
      
      let errorMessage = "Unknown error occurred";
      
      if (error && typeof error === 'object') {
        // Handle different error types
        if (error.message) {
          errorMessage = error.message;
        } else if (error.code) {
          errorMessage = `Error code: ${error.code}`;
        } else if (error.name) {
          errorMessage = `Error: ${error.name}`;
        } else {
          errorMessage = JSON.stringify(error);
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      console.log("Processed error message:", errorMessage);
      
      // User-friendly error messages
      if (errorMessage.includes("rejected") || errorMessage.includes("denied")) {
        errorMessage = "Transaction was rejected in HashPack";
      } else if (errorMessage.includes("timeout")) {
        errorMessage = "Wallet didn't respond. Please try again.";
      } else if (errorMessage.includes("session") || errorMessage.includes("topic")) {
        errorMessage = "Wallet session issue. Please reconnect your wallet.";
      } else if (errorMessage.includes("insufficient")) {
        errorMessage = "Insufficient balance for transaction";
      } else if (errorMessage.includes("contract") || errorMessage.includes("address")) {
        errorMessage = `Contract issue: ${errorMessage}`;
      }
      
      setStatus(`❌ ${errorMessage}`);
      alert(`❌ ${errorMessage}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Integro</h1>
        <p>Powered by Hedera</p>
      </div>

      <div className="page-container">
        <div className="card">
          <h3>Wallet Connection</h3>
          <div className={`status-message ${accountId ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
            {accountId ? `✅ Connected as: ${accountId}` : status}
          </div>
          
          {accountId ? (
            <div className="connected-state">
              <button onClick={handleDisconnect} className="hedera-button disconnect">
                🚪 Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={handleConnect} 
              className="hedera-button"
              disabled={isLoading}
            >
              {isLoading ? "🔄 Connecting..." : "🔗 Connect Wallet"}
            </button>
          )}
        </div>

        {accountId && (
          <div className="card">
            <h3>Create Test Gig</h3>
            <p>This will create a test gig on our smart contract with 1 HBAR escrow.</p>
            <button 
              onClick={handleCreateTestGig} 
              className="hedera-button"
              disabled={isTransactionLoading}
            >
              {isTransactionLoading ? "🔄 Processing..." : "Create Test Gig (1 HBAR)"}
            </button>
            <div style={{marginTop: '10px', fontSize: '12px', color: '#666', textAlign: 'center'}}>
              ⚠️ Make sure your wallet has testnet HBAR
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// CSS Styles - Our proven working styles
function CustomStyles() {
  return (
    <style>{`
      .container { 
        max-width: 480px; 
        margin: 20px auto; 
        background: #f9f9f9; 
        border-radius: 20px; 
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1); 
        overflow: hidden; 
        display: flex; 
        flex-direction: column; 
        font-family: Arial, sans-serif;
      }
      .header { 
        background: linear-gradient(135deg, #1A1A1A, #000000); 
        color: white; 
        padding: 20px; 
        text-align: center; 
      }
      .header h1 { 
        font-size: 28px; 
        margin: 0; 
      }
      .header p { 
        font-size: 12px; 
        opacity: 0.8; 
        margin-top: 4px; 
      }
      .page-container { 
        padding: 20px; 
      }
      .card { 
        background: white; 
        padding: 20px; 
        border-radius: 15px; 
        margin-bottom: 15px;
      }
      .hedera-button { 
        background: #2DD87F; 
        color: black; 
        border: none; 
        padding: 14px; 
        border-radius: 12px; 
        font-size: 16px; 
        cursor: pointer; 
        width: 100%; 
        margin-top: 15px; 
        font-weight: 600; 
        transition: background 0.3s;
      }
      .hedera-button:hover:not(:disabled) { 
        background: #25b366; 
      }
      .hedera-button:disabled { 
        background: #cccccc; 
        cursor: not-allowed; 
      }
      .hedera-button.disconnect { 
        background: #ff4444; 
        color: white; 
      }
      .hedera-button.disconnect:hover { 
        background: #cc3333; 
      }
      .status-message { 
        padding: 10px; 
        border-radius: 8px; 
        margin-bottom: 15px; 
        text-align: center; 
      }
      .status-info { 
        background: #e3f2fd; 
        color: #1565c0; 
      }
      .status-success { 
        background: #e8f5e8; 
        color: #2e7d32; 
      }
      .status-error { 
        background: #ffebee; 
        color: #c62828; 
      }
    `}</style>
  );
}

function MainApp() { 
  return (
    <>
      <CustomStyles />
      <App />
    </>
  ); 
}

export default MainApp;