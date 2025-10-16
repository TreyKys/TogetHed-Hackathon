import { useEffect, useState } from "react";
import './App.css';

import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import { 
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  AccountId,
  Hbar
} from "@hashgraph/sdk";

import { escrowContractAddress } from "./hedera.js";

const projectId = "2798ba475f686a8e0ec83cc2cceb095b";

function App() {
  const [accountId, setAccountId] = useState(null);
  const [status, setStatus] = useState("Initializing WalletConnect...");
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const [signClient, setSignClient] = useState(null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    async function initialize() {
      try {
        const client = await SignClient.init({
          projectId: projectId,
          metadata: {
            name: "Integro Marketplace",
            description: "A skill marketplace on Hedera",
            url: window.location.origin,
            icons: [],
          },
        });
        
        const wcModal = new WalletConnectModal({
          projectId: projectId,
          chains: ["hedera:testnet"],
        });

        client.on("session_connect", (event) => {
          const connectedAccountId = event.params.namespaces.hedera.accounts[0].split(':')[2];
          setAccountId(connectedAccountId);
          setStatus(`✅ Connected as: ${connectedAccountId}`);
        });

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
        setStatus("✅ URI generated! Please scan with HashPack.");
        await modal.openModal({ uri });
        await approval();
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

  // *** TARGETED FIX FOR WALLETCONNECT_REQUEST ERROR ***
  const handleCreateTestGig = async () => {
    if (!signClient || !accountId) {
      alert("Please connect wallet first.");
      return;
    }

    setIsTransactionLoading(true);
    setStatus("🚀 Starting transaction...");
    
    try {
      // Step 1: Get session
      const sessionKeys = Array.from(signClient.session.keys);
      if (sessionKeys.length === 0) {
        throw new Error("No active wallet session");
      }
      const session = signClient.session.get(sessionKeys[0]);
      
      if (!session?.topic) {
        throw new Error("Invalid session topic");
      }

      setStatus("📝 Building transaction...");

      // Step 2: Create a SIMPLE test transaction first
      // Let's test with a basic transfer instead of contract call
      const transaction = new TransferTransaction()
        .addHbarTransfer(accountId, Hbar.fromTinybars(-100000000)) // -1 HBAR from user
        .addHbarTransfer("0.0.3", Hbar.fromTinybars(100000000))   // +1 HBAR to treasury
        .setTransactionMemo("Integro test transaction")
        .setMaxTransactionFee(new Hbar(2));

      setStatus("💾 Converting to bytes...");

      // Step 3: Convert to bytes
      const transactionBytes = await transaction.toBytes();
      
      setStatus("📤 Sending to HashPack...");

      // Step 4: WalletConnect request with SIMPLIFIED parameters
      const result = await signClient.request({
        topic: session.topic,
        chainId: "hedera:testnet",
        request: {
          method: "hedera_signAndExecuteTransaction",
          params: {
            transaction: transactionBytes
          }
        }
      });

      // Step 5: Handle response
      if (result?.transactionId) {
        setStatus("✅ Test transaction successful!");
        alert(`🎉 Success! TX: ${result.transactionId}`);
      } else {
        setStatus("✅ Transaction submitted!");
        alert("Transaction submitted successfully!");
      }

    } catch (error) {
      // Enhanced error handling for walletconnect_request
      console.error("WalletConnect request error:", error);
      
      let errorMessage = "Transaction failed";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `Error code: ${error.code}`;
      } else {
        errorMessage = "Wallet rejected or network error";
      }

      // Specific fixes for common issues:
      if (errorMessage.includes("rejected") || errorMessage.includes("denied")) {
        errorMessage = "Transaction was rejected in HashPack";
      } else if (errorMessage.includes("timeout")) {
        errorMessage = "Wallet didn't respond. Please try again.";
      }

      setStatus(`❌ ${errorMessage}`);
      alert(`❌ ${errorMessage}`);
      
      // Additional troubleshooting tips
      if (errorMessage.includes("Wallet rejected")) {
        alert("💡 Tip: Make sure you have enough testnet HBAR and try again.");
      }
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
            <h3>Test Simple Transaction</h3>
            <p>We're testing with a simple HBAR transfer first</p>
            <button 
              onClick={handleCreateTestGig} 
              className="hedera-button"
              disabled={isTransactionLoading}
            >
              {isTransactionLoading ? "🔄 Processing..." : "Test Simple Transfer (1 HBAR)"}
            </button>
            <div style={{marginTop: '10px', fontSize: '12px', color: '#666', textAlign: 'center'}}>
              🔧 Testing basic transaction flow first
            </div>
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