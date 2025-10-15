import { useEffect, useState } from "react";
import './App.css';

// Import the correct libraries
import {
  HederaSessionEvent,
  HederaJsonRpcMethod,
  DAppConnector,
  HederaChainId,
} from "@hashgraph/hedera-wallet-connect";
import { 
  LedgerId,
  ContractExecuteTransaction,
  ContractFunctionParameters
} from "@hashgraph/sdk";

// Import our contract address
import { escrowContractAddress } from "./hedera.js";

const projectId = "2798ba475f686a8e0ec83cc2cceb095b";

function App() {
  const [accountId, setAccountId] = useState(null);
  const [dAppConnector, setDAppConnector] = useState(null);
  const [status, setStatus] = useState("Initializing Connector...");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function initialize() {
      try {
        const metadata = { name: "Integro Marketplace", description: "A skill marketplace on Hedera", url: window.location.origin, icons: [] };
        const connector = new DAppConnector( metadata, LedgerId.Testnet, projectId, Object.values(HederaJsonRpcMethod), [HederaSessionEvent.AccountsChanged], [HederaChainId.Testnet] );
        await connector.init({ logger: "error" });

        connector.on(HederaSessionEvent.AccountsChanged, (accounts) => {
          if (accounts && accounts.length > 0) {
            setAccountId(accounts[0]);
            setStatus("✅ Wallet Connected!");
          } else {
            setAccountId(null);
            setStatus("Disconnected.");
          }
        });
        
        setDAppConnector(connector);
        if (connector.accounts && connector.accounts.length > 0) {
            setAccountId(connector.accounts[0]);
            setStatus("✅ Restored previous connection!");
        } else {
            setStatus("Ready to connect.");
        }
      } catch (error) {
        console.error("Initialization failed:", error);
        setStatus(`❌ Error: ${error.message}`);
      }
    }
    initialize();
  }, []);

  const onConnect = async () => {
    if (dAppConnector) await dAppConnector.openModal();
  };

  const onDisconnect = async () => {
    if (dAppConnector) await dAppConnector.disconnect();
  };

  // *** THIS IS THE FINAL, ROBUST TRANSACTION FUNCTION ***
  const handleCreateTestGig = async () => {
      if (!dAppConnector || !accountId) return alert("Please connect wallet first.");
      setIsLoading(true);
      setStatus("🚀 Preparing transaction...");
      try {
          const transaction = new ContractExecuteTransaction()
              .setContractId(escrowContractAddress.slice(2))
              .setGas(150000)
              .setFunction("createGig", new ContractFunctionParameters()
                  .addAddress(accountId)
                  .addUint256(1 * 1e8) // 1 HBAR
              );
          
          setStatus("... Please approve transaction in your wallet ...");
          const result = await dAppConnector.sendTransaction(transaction);
          
          // *** THIS IS THE FIX ***
          // 1. Log the raw response so we can see its structure.
          console.log("Raw Wallet Response:", result);

          // 2. Add a defensive check to prevent the crash.
          if (result && result.transactionId) {
            setStatus("✅ Test Gig successfully created on Hedera!");
            alert(`Success! Transaction ID: ${result.transactionId}`);
          } else {
            setStatus("✅ Transaction sent, but response format is unexpected. Check console log.");
            alert("Success! Transaction was sent. Please check the console log for the full response.");
          }

      } catch (error) {
          console.error("Transaction failed:", error);
          setStatus(`❌ Error: ${error.message}`);
          alert(`Error: ${error.message}`);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="container">
      <div className="header"><h1>Integro</h1><p>Powered by Hedera</p></div>
      <div className="page-container">
        <div className="card">
          <h3>Wallet Connection & Test</h3>
          <div className={`status-message ${accountId ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
            {accountId ? `Connected as: ${accountId}` : status}
          </div>
          {accountId ? (
            <div className="connected-state">
              <button onClick={onDisconnect} className="hedera-button disconnect">Disconnect</button>
            </div>
          ) : (
            <button onClick={onConnect} className="hedera-button" disabled={isLoading}>
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

function CustomStyles() { return (<style>{` /* ... CSS from previous version ... */ `}</style>); }
function MainApp() { return (<><CustomStyles /><App /></>); }
export default MainApp;
