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

  // *** NEW: CAREFULLY ADDED TRANSACTION FUNCTION ***
  const handleCreateTestGig = async () => {
    if (!signClient || !accountId) {
      alert("Please connect wallet first.");
      return;
    }

    setIsTransactionLoading(true);
    setStatus("🚀 Preparing transaction...");
    
    try {
      // Step 1: Get the active session
      const sessionKeys = Array.from(signClient.session.keys);
      if (sessionKeys.length === 0) {
        throw new Error("No active session found");
      }
      const session = signClient.session.get(sessionKeys[0]);
      
      // Step 2: Prepare contract ID (handle both string and object formats)
      let contractId;
      if (typeof escrowContractAddress === 'string') {
        if (escrowContractAddress.startsWith('0x')) {
          // EVM address - remove 0x prefix
          const addressWithoutPrefix = escrowContractAddress.slice(2);
          contractId = ContractId.fromEvmAddress(0, 0, addressWithoutPrefix);
        } else if (escrowContractAddress.startsWith('0.0.')) {
          // Native Hedera format
          contractId = ContractId.fromString(escrowContractAddress);
        } else {
          throw new Error("Invalid contract address format");
        }
      } else {
        // Already a ContractId object
        contractId = escrowContractAddress;
      }

      // Step 3: Convert user account to EVM address for contract call
      const userAccountId = AccountId.fromString(accountId);
      const userEvmAddress = userAccountId.toSolidityAddress();

      setStatus("📝 Building transaction...");

      // Step 4: Create the transaction
      const transaction = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(300000) // Sufficient gas
        .setMaxTransactionFee(new Hbar(2)) // Set reasonable fee
        .setFunction("createGig", new ContractFunctionParameters()
          .addAddress(userEvmAddress) // 40-character EVM address
          .addUint256(100000000) // 1 HBAR in tinybars
        )
        .freezeWith(null); // Freeze transaction

      setStatus("⏳ Sending to HashPack...");

      // Step 5: Send transaction through WalletConnect
      const result = await signClient.request({
        topic: session.topic,
        chainId: "hedera:testnet",
        request: {
          method: "hedera_signAndExecuteTransaction",
          params: {
            transaction: await transaction.toBytes()
          }
        }
      });

      // Step 6: Handle the response
      if (result && result.transactionId) {
        setStatus("✅ Test Gig created successfully!");
        alert(`🎉 Success! Transaction ID: ${result.transactionId}`);
      } else {
        setStatus("✅ Transaction submitted!");
        alert("Transaction submitted successfully!");
      }

    } catch (error) {
      console.error("Transaction error:", error);
      setStatus(`❌ Transaction failed: ${error.message}`);
      alert(`Error: ${error.message}`);
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
            <div style={{marginTop: '10px', fontSize: '12px', color: '#666'}}>
              Make sure your wallet has testnet HBAR
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