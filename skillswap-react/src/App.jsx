import { useEffect, useState } from "react";
import './App.css';

// CORRECT IMPORTS - Using our working WalletConnect solution
import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import { 
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId  // ← ADDED THIS IMPORT
} from "@hashgraph/sdk";

// Import our contract address
import { escrowContractAddress } from "./hedera.js";

const projectId = "2798ba475f686a8e0ec83cc2cceb095b";

function App() {
  const [accountId, setAccountId] = useState(null);
  const [status, setStatus] = useState("Initializing WalletConnect...");
  const [isLoading, setIsLoading] = useState(true);
  const [signClient, setSignClient] = useState(null);
  const [modal, setModal] = useState(null);

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
            icons: [],
          },
        });
        
        const wcModal = new WalletConnectModal({
          projectId: projectId,
          chains: ["hedera:testnet"],
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
        setStatus("❌ Initialization Failed");
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
        setStatus("✅ URI generated! Please scan with HashPack.");
        await modal.openModal({ uri });
        await approval();
        modal.closeModal();
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setStatus("❌ Connection Failed or Rejected.");
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

  // *** FIXED TRANSACTION FUNCTION WITH CONTRACT ADDRESS CONVERSION ***
  const handleCreateTestGig = async () => {
    if (!signClient || !accountId) {
      alert("Please connect wallet first.");
      return;
    }

    setIsLoading(true);
    setStatus("🚀 Preparing transaction...");
    
    try {
      // Convert EVM address to Hedera contract ID
      const evmAddress = escrowContractAddress; // "0xaB88Af4647228099fBd2904C25A6feb657beb19a"
      
      // Remove '0x' prefix and convert to Hedera format
      const addressWithoutPrefix = evmAddress.slice(2);
      
      // Create contract ID from EVM address (THIS IS THE KEY FIX)
      const contractId = ContractId.fromEvmAddress(0, 0, addressWithoutPrefix);
      
      const transaction = new ContractExecuteTransaction()
        .setContractId(contractId) // Use the converted contract ID
        .setGas(150000)
        .setFunction("createGig", new ContractFunctionParameters()
          .addAddress(accountId)
          .addUint256(1 * 1e8) // 1 HBAR
        );

      setStatus("📝 Please approve transaction in your wallet...");

      // Get current session
      const session = signClient.session.get(signClient.session.keys[0]);
      
      // Send transaction through WalletConnect
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

      if (result && result.transactionId) {
        setStatus("✅ Test Gig successfully created on Hedera!");
        alert(`Success! Transaction ID: ${result.transactionId}`);
      } else {
        setStatus("✅ Transaction sent! Check wallet for confirmation.");
        alert("Transaction submitted successfully!");
      }

    } catch (error) {
      console.error("❌ Transaction failed:", error);
      setStatus(`❌ Error: ${error.message}`);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
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
            <button onClick={handleCreateTestGig} className="hedera-button" disabled={isLoading}>
              {isLoading ? "🔄 Processing..." : "Create Test Gig (1 HBAR)"}
            </button>
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