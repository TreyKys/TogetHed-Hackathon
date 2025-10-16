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

  // *** ULTRA-DEBUG VERSION - CAPTURES EVERYTHING ***
  const handleCreateTestGig = async () => {
    if (!signClient || !accountId) {
      alert("Please connect wallet first.");
      return;
    }

    setIsTransactionLoading(true);
    setStatus("🚀 Starting transaction process...");
    
    // Track which step we're on
    let currentStep = "start";
    
    try {
      currentStep = "session_validation";
      setStatus("🔍 Validating session...");
      
      // Step 1: Session validation
      const sessionKeys = Array.from(signClient.session.keys);
      if (sessionKeys.length === 0) {
        throw new Error("No active wallet session");
      }
      const session = signClient.session.get(sessionKeys[0]);
      
      if (!session?.topic) {
        throw new Error("Invalid session topic");
      }

      currentStep = "contract_address";
      setStatus("📝 Processing contract address...");

      // Step 2: Contract address handling
      let contractId;
      if (!escrowContractAddress) {
        throw new Error("No contract address found in hedera.js");
      }

      if (typeof escrowContractAddress === 'string') {
        if (escrowContractAddress.startsWith('0x')) {
          const cleanAddress = escrowContractAddress.slice(2);
          if (cleanAddress.length !== 40) {
            throw new Error(`EVM address wrong length: ${cleanAddress.length} chars`);
          }
          contractId = ContractId.fromEvmAddress(0, 0, cleanAddress);
        } else if (escrowContractAddress.startsWith('0.0.')) {
          contractId = ContractId.fromString(escrowContractAddress);
        } else {
          throw new Error(`Unknown address format: ${escrowContractAddress}`);
        }
      } else {
        contractId = escrowContractAddress;
      }

      currentStep = "user_address";
      setStatus("👤 Converting user address...");

      // Step 3: User address conversion
      const userAccountId = AccountId.fromString(accountId);
      const userEvmAddress = userAccountId.toSolidityAddress();

      if (userEvmAddress.length !== 40) {
        throw new Error(`User EVM address wrong length: ${userEvmAddress.length} chars`);
      }

      currentStep = "transaction_build";
      setStatus("🔨 Building transaction...");

      // Step 4: Transaction building
      const transaction = new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(1000000)
        .setMaxTransactionFee(new Hbar(10))
        .setFunction("createGig", new ContractFunctionParameters()
          .addAddress(userEvmAddress)
          .addUint256(100000000) // 1 HBAR
        );

      currentStep = "transaction_bytes";
      setStatus("💾 Converting to bytes...");

      // Step 5: Convert to bytes
      const transactionBytes = await transaction.toBytes();
      
      if (!transactionBytes || transactionBytes.length === 0) {
        throw new Error("Failed to convert transaction to bytes");
      }

      currentStep = "walletconnect_request";
      setStatus("📤 Sending to wallet...");

      // Step 6: WalletConnect request with ULTRA error handling
      const requestOptions = {
        topic: session.topic,
        chainId: "hedera:testnet",
        request: {
          method: "hedera_signAndExecuteTransaction",
          params: {
            transaction: transactionBytes
          }
        }
      };

      console.log("Sending request:", requestOptions);

      // Create a promise with explicit error handling
      const requestPromise = new Promise((resolve, reject) => {
        try {
          signClient.request(requestOptions)
            .then(resolve)
            .catch(reject);
        } catch (syncError) {
          reject(new Error(`Sync error in request: ${syncError.message}`));
        }
      });

      // Add timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: Wallet didn't respond in 30 seconds")), 30000);
      });

      const result = await Promise.race([requestPromise, timeoutPromise]);
      
      currentStep = "response_handling";
      setStatus("📨 Processing response...");

      // Handle response
      if (!result) {
        throw new Error("Empty response from wallet");
      }

      if (result.transactionId) {
        setStatus("✅ Success! Gig created.");
        alert(`🎉 Success! TX: ${result.transactionId}`);
      } else {
        setStatus("✅ Transaction submitted!");
        alert("Transaction submitted successfully!");
      }

    } catch (error) {
      // ULTRA COMPREHENSIVE ERROR HANDLING
      console.error(`Error at step ${currentStep}:`, error);
      
      let errorDetails = "Unknown error";
      
      // Capture EVERY possible error format
      if (error === null) {
        errorDetails = "Error is null";
      } else if (error === undefined) {
        errorDetails = "Error is undefined";
      } else if (typeof error === 'string') {
        errorDetails = error;
      } else if (error instanceof Error) {
        errorDetails = error.message || "Error object with no message";
      } else if (typeof error === 'object') {
        try {
          // Try to stringify the entire error object
          const stringified = JSON.stringify(error);
          if (stringified === '{}') {
            errorDetails = `Empty object error at step: ${currentStep}`;
          } else {
            errorDetails = stringified;
          }
        } catch (e) {
          errorDetails = `Unstringifiable object: ${String(error)}`;
        }
      } else {
        errorDetails = String(error);
      }

      // Add step context to error
      const fullErrorMessage = `Step ${currentStep}: ${errorDetails}`;
      
      console.log("Full error analysis:", {
        currentStep,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorString: String(error),
        errorJSON: JSON.stringify(error)
      });

      setStatus(`❌ ${fullErrorMessage}`);
      alert(`❌ Error: ${fullErrorMessage}`);
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
            <h3>Debug Transaction</h3>
            <p>This version has ultra-detailed error tracking</p>
            <button 
              onClick={handleCreateTestGig} 
              className="hedera-button"
              disabled={isTransactionLoading}
            >
              {isTransactionLoading ? "🔄 Processing..." : "Debug Create Gig (1 HBAR)"}
            </button>
            <div style={{marginTop: '10px', fontSize: '12px', color: '#666', textAlign: 'center'}}>
              🔍 This version tracks exactly where errors occur
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