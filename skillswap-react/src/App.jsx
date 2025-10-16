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
  const [status, setStatus] = useState("Initializing...");
  const [isLoading, setIsLoading] = useState(false);
  const [signClient, setSignClient] = useState(null);

  useEffect(() => {
    initializeWalletConnect();
  }, []);

  const initializeWalletConnect = async () => {
    try {
      const client = await SignClient.init({
        projectId,
        metadata: {
          name: "Integro Marketplace",
          description: "A skill marketplace on Hedera",
          url: window.location.origin,
          icons: ["https://cdn.hashpack.app/img/logo.png"],
        },
      });
      
      const modal = new WalletConnectModal({
        projectId,
        chains: ["hedera:testnet"],
      });

      client.on("session_connect", (event) => {
        const account = event.params.namespaces.hedera.accounts[0].split(':')[2];
        setAccountId(account);
        setStatus(`✅ Connected: ${account}`);
      });

      // Check existing sessions
      if (client.session.length > 0) {
        const sessions = Array.from(client.session.values());
        const lastSession = sessions[sessions.length - 1];
        const account = lastSession.namespaces.hedera.accounts[0].split(':')[2];
        setAccountId(account);
        setStatus(`✅ Connected: ${account}`);
      } else {
        setStatus("Ready to connect");
      }

      setSignClient(client);
    } catch (error) {
      setStatus("❌ Initialization failed");
    }
  };

  const handleConnect = async () => {
    if (!signClient) return;
    
    setIsLoading(true);
    setStatus("Connecting...");
    
    try {
      const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
          hedera: {
            methods: ["hedera_signAndExecuteTransaction"],
            chains: ["hedera:testnet"],
            events: ["accountsChanged"],
          },
        },
      });

      if (uri) {
        const modal = new WalletConnectModal({ projectId, chains: ["hedera:testnet"] });
        await modal.openModal({ uri });
        await approval();
        modal.closeModal();
      }
    } catch (error) {
      setStatus("❌ Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  // SIMPLIFIED TRANSACTION FUNCTION - Let's debug step by step
  const handleCreateTestGig = async () => {
  alert("Button clicked - starting transaction...");
  
  if (!signClient || !accountId) {
    alert("❌ No wallet connected");
    return;
  }

  try {
    alert("Step 1: Getting session...");
    const sessions = Array.from(signClient.session.values());
    const session = sessions[0];
    
    alert("Step 2: Creating simple transfer...");
    // Let's try a simple HBAR transfer instead of contract call
    const transaction = await new TransferTransaction()
      .addHbarTransfer(accountId, new Hbar(-1)) // Send 1 HBAR from user
      .addHbarTransfer("0.0.123456", new Hbar(1)) // Send to some account
      .freezeWith(signClient);

    alert("Step 3: Sending to wallet...");
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

    alert("✅ Success! Transaction sent");
    
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  }
};
  const handleDisconnect = async () => {
    if (signClient) {
      const sessions = Array.from(signClient.session.values());
      if (sessions.length > 0) {
        await signClient.disconnect({
          topic: sessions[0].topic,
          reason: { code: 6000, message: "User disconnected" }
        });
      }
      setAccountId(null);
      setStatus("Disconnected");
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
            {accountId ? `Connected: ${accountId}` : status}
          </div>
          
          {accountId ? (
            <button onClick={handleDisconnect} className="hedera-button disconnect">
              Disconnect
            </button>
          ) : (
            <button onClick={handleConnect} className="hedera-button" disabled={isLoading}>
              {isLoading ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>

        {accountId && (
          <div className="card">
            <h3>Test Transaction</h3>
            <p>Create a test gig on the smart contract</p>
            <button onClick={handleCreateTestGig} className="hedera-button" disabled={isLoading}>
              {isLoading ? "Processing..." : "Create Test Gig (1 HBAR)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Keep your existing CSS styles
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
      }
      .hedera-button:disabled { 
        background: #cccccc; 
        cursor: not-allowed; 
      }
      .hedera-button.disconnect { 
        background: #ff4444; 
        color: white; 
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