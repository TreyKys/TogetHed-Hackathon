import { useEffect, useState } from "react";
import './App.css';

// CORRECT IMPORTS - Using our working WalletConnect solution
import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import { 
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  AccountId
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
  const [currentSession, setCurrentSession] = useState(null);

  // Initialize our WORKING WalletConnect solution
  useEffect(() => {
    async function initialize() {
      try {
        const client = await SignClient.init({
          projectId: projectId,
          metadata: {
            name: "Integro Marketplace",
            description: "A skill marketplace on Hedera",
            url: window.location.origin,
            icons: ["https://cdn.hashpack.app/img/logo.png"],
          },
        });
        
        const wcModal = new WalletConnectModal({
          projectId: projectId,
          chains: ["hedera:testnet"],
        });

        // Set up event listeners for session management
        client.on("session_connect", (event) => {
          console.log("🔗 Session connected:", event);
          const connectedAccountId = event.params.namespaces.hedera.accounts[0].split(':')[2];
          setAccountId(connectedAccountId);
          setCurrentSession(event);
          setStatus(`✅ Connected as: ${connectedAccountId}`);
        });

        client.on("session_delete", (event) => {
          console.log("🔗 Session deleted:", event);
          setAccountId(null);
          setCurrentSession(null);
          setStatus("Disconnected");
        });

        client.on("session_event", (event) => {
          console.log("🔗 Session event:", event);
        });

        client.on("session_request", (event) => {
          console.log("🔗 Session request:", event);
        });

        // Check for existing sessions
        if (client.session.length > 0) {
          const sessionKeys = Array.from(client.session.keys);
          const lastSessionKey = sessionKeys[sessionKeys.length - 1];
          const lastSession = client.session.get(lastSessionKey);
          
          console.log("🔗 Found existing session:", lastSession);
          
          if (lastSession && lastSession.namespaces.hedera && lastSession.namespaces.hedera.accounts.length > 0) {
            const existingAccountId = lastSession.namespaces.hedera.accounts[0].split(':')[2];
            setAccountId(existingAccountId);
            setCurrentSession(lastSession);
            setStatus(`✅ Connected as: ${existingAccountId}`);
          }
        }

        setSignClient(client);
        setModal(wcModal);
        setStatus("Ready to connect");
        setIsLoading(false);

      } catch (error) {
        console.error("❌ Initialization failed:", error);
        setStatus(`❌ Initialization Failed: ${error.message}`);
        setIsLoading(false);
      }
    }
    initialize();
  }, []);

  // WORKING connection function
  const handleConnect = async () => {
    if (!signClient || !modal) {
      setStatus("❌ Connector not ready. Please refresh.");
      return;
    }
    setIsLoading(true);
    setStatus("🔄 Requesting session from server...");

    try {
      const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
          hedera: {
            methods: ["hedera_signMessage", "hedera_signAndExecuteTransaction"],
            chains: ["hedera:testnet"],
            events: ["chainChanged", "accountsChanged"],
          },
        },
      });

      if (uri) {
        setStatus("✅ URI generated! Opening HashPack...");
        await modal.openModal({ uri });
        
        // Wait for user approval
        setStatus("⏳ Waiting for approval in HashPack...");
        const session = await approval();
        
        console.log("✅ Session approved:", session);
        
        if (session && session.namespaces.hedera.accounts.length > 0) {
          const connectedAccountId = session.namespaces.hedera.accounts[0].split(':')[2];
          setAccountId(connectedAccountId);
          setCurrentSession(session);
          setStatus(`✅ Connected as: ${connectedAccountId}`);
        }
        
        modal.closeModal();
      }
    } catch (error) {
      console.error("❌ Connection failed:", error);
      setStatus(`❌ Connection Failed: ${error.message || "User rejected or connection failed"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (signClient && currentSession) {
      try {
        await signClient.disconnect({
          topic: currentSession.topic,
          reason: { code: 6000, message: "User disconnected" },
        });
        setAccountId(null);
        setCurrentSession(null);
        setStatus("Disconnected");
      } catch (error) {
        console.error("❌ Disconnect error:", error);
        setStatus(`❌ Disconnect error: ${error.message}`);
      }
    }
  };

  // *** FIXED TRANSACTION FUNCTION WITH PROPER SESSION HANDLING ***
  const handleCreateTestGig = async () => {
    if (!signClient || !accountId || !currentSession) {
      alert("❌ Please connect wallet first and ensure session is active.");
      return;
    }

    setIsTransactionLoading(true);
    setStatus("🚀 Preparing transaction...");
    
    try {
      // Convert contract address properly
      let contractId;
      
      if (typeof escrowContractAddress === 'string') {
        if (escrowContractAddress.startsWith('0x')) {
          const addressWithoutPrefix = escrowContractAddress.slice(2);
          if (addressWithoutPrefix.length !== 40) {
            throw new Error(`Invalid EVM address length: ${addressWithoutPrefix.length} chars`);
          }
          contractId = ContractId.fromEvmAddress(0, 0, addressWithoutPrefix);
        } else if (escrowContractAddress.startsWith('0.0.')) {
          contractId = ContractId.fromString(escrowContractAddress);
        } else {
          throw new Error(`Invalid contract address format: ${escrowContractAddress}`);
        }
      } else {
        contractId = escrowContractAddress;
      }

      // Convert user account to EVM address
      const userAccountId = AccountId.fromString(accountId);
      const userEvmAddress = userAccountId.toSolidityAddress();
      
      if (userEvmAddress.length !== 40) {
        throw new Error(`Invalid user EVM address: ${userEvmAddress}`);
      }

      console.log("📝 Transaction details:", {
        contractId: contractId.toString(),
        userEvmAddress,
        accountId
      });

      // Build transaction
      const transaction = new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(300000)
        .setFunction("createGig", new ContractFunctionParameters()
          .addAddress(userEvmAddress)
          .addUint256(1 * 1e8) // 1 HBAR
        );

      setStatus("📝 Please approve transaction in HashPack...");

      // Get the transaction bytes
      const transactionBytes = await transaction.toBytes();
      
      console.log("🔗 Sending transaction with session:", currentSession.topic);

      // Send transaction through WalletConnect with proper error handling
      const result = await signClient.request({
        topic: currentSession.topic,
        chainId: "hedera:testnet",
        request: {
          method: "hedera_signAndExecuteTransaction",
          params: {
            transaction: transactionBytes,
            // Add any additional required parameters
          }
        }
      });

      console.log("📨 Transaction response:", result);

      // Handle different response formats
      if (!result) {
        throw new Error("No response received from wallet");
      }

      if (result.transactionId) {
        setStatus("✅ Test Gig successfully created on Hedera!");
        alert(`🎉 Success! Transaction ID: ${result.transactionId}`);
      } else if (result.id) {
        setStatus("✅ Transaction submitted! Waiting for confirmation...");
        alert(`✅ Transaction submitted! ID: ${result.id}`);
      } else if (result.hash) {
        setStatus("✅ Transaction submitted! Waiting for confirmation...");
        alert(`✅ Transaction submitted! Hash: ${result.hash}`);
      } else {
        // If we get here but no error, the transaction might still be successful
        setStatus("✅ Transaction sent - check HashPack for confirmation");
        alert("✅ Transaction sent successfully! Please check HashPack for confirmation.");
      }

    } catch (error) {
      console.error("❌ Transaction failed:", error);
      console.error("❌ Full error object:", JSON.stringify(error, null, 2));
      
      let errorMessage = error.message || "Unknown error occurred";
      
      // Provide more user-friendly error messages
      if (errorMessage.includes("rejected")) {
        errorMessage = "Transaction was rejected in HashPack";
      } else if (errorMessage.includes("timeout")) {
        errorMessage = "Transaction timed out. Please try again.";
      } else if (errorMessage.includes("session") || errorMessage.includes("topic")) {
        errorMessage = "Wallet session issue. Please reconnect your wallet.";
      }
      
      setStatus(`❌ ${errorMessage}`);
      alert(`❌ Error: ${errorMessage}`);
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
          <h3>Wallet Connection & Test</h3>
          <div className={`status-message ${accountId ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
            {accountId ? `Connected as: ${accountId}` : status}
            {currentSession && <div style={{fontSize: '12px', opacity: 0.7}}>Session Active</div>}
          </div>
          
          {accountId ? (
            <div className="connected-state">
              <button onClick={handleDisconnect} className="hedera-button disconnect">Disconnect</button>
            </div>
          ) : (
            <button onClick={handleConnect} className="hedera-button" disabled={isLoading}>
              {isLoading ? "🔄 Initializing..." : "🔗 Connect Wallet"}
            </button>
          )}
        </div>

        {accountId && (
          <div className="card">
            <h3>On-Chain Test</h3>
            <p>This will send a real transaction to our Escrow smart contract.</p>
            <button 
              onClick={handleCreateTestGig} 
              className="hedera-button" 
              disabled={isTransactionLoading || !currentSession}
            >
              {isTransactionLoading ? "🔄 Processing..." : "Create Test Gig (1 HBAR)"}
            </button>
            {!currentSession && (
              <div style={{color: 'orange', fontSize: '14px', marginTop: '10px'}}>
                ⚠️ Session not ready. Please try reconnecting.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// CSS Styles
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