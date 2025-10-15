import { useEffect, useState } from "react";
import './App.css';

// 1. Import the correct, native Hedera libraries
import {
  HederaSessionEvent,
  HederaJsonRpcMethod,
  DAppConnector,
  HederaChainId,
} from "@hashgraph/hedera-wallet-connect";
import { 
  LedgerId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  AccountId // Import AccountId for conversion
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

  const handleCreateTestGig = async () => {
      if (!dAppConnector || !accountId) return alert("Please connect wallet first.");
      setIsLoading(true);
      setStatus("🚀 Preparing transaction...");
      
      // DEBUGGING STEP: Log the address before using it.
      console.log("Using Contract Address:", escrowContractAddress);

      try {
          // FIX 1: Convert Hedera Account ID to Solidity address for the contract parameter.
          const sellerSolidityAddress = AccountId.fromString(accountId).toSolidityAddress();

          const transaction = new ContractExecuteTransaction()
              // FIX 2: Pass the full, unaltered '0x' address to the SDK.
              .setContractId(escrowContractAddress)
              .setGas(150000)
              .setFunction("createGig", new ContractFunctionParameters()
                  .addAddress(sellerSolidityAddress)
                  .addUint256(1 * 1e8) // Price: 1 HBAR (1 * 10^8 tinybar)
              );
          
          setStatus("... Please approve transaction in your wallet ...");
          const result = await dAppConnector.sendTransaction(transaction);
          
          if (result && (result.transactionId || result.receipt)) {
            setStatus("✅ Test Gig successfully created on Hedera!");
            alert(`Success! Transaction confirmed.`);
            console.log("Full Wallet Response:", result);
          } else {
            setStatus("✅ Tx sent, but response format is unexpected. Check console.");
            alert("Success! Transaction was sent. Check console for the full response.");
            console.log("Raw Wallet Response:", result);
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

// Inline CSS from the previous working version
function CustomStyles() { return (<style>{`
    .container { max-width: 480px; margin: 20px auto; background: #f9f9f9; border-radius: 20px; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1); }
    .header { background: linear-gradient(135deg, #1A1A1A, #000000); color: white; padding: 20px; text-align: center; border-radius: 20px 20px 0 0; }
    .header h1 { font-family: 'Comfortaa', cursive; font-size: 28px; margin: 0; } .header p { font-size: 12px; opacity: 0.8; margin-top: 4px; }
    .page-container { padding: 20px; } .card { background: white; padding: 20px; border-radius: 15px; margin-bottom: 15px; }
    .hedera-button { background: #2DD87F; color: black; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer; width: 100%; font-weight: 600; }
    .hedera-button:disabled { background: #ccc; cursor: not-allowed; }
    .hedera-button.disconnect { background: #6c757d; color: white; }
    .status-message { padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center; }
    .status-info { background: #e3f2fd; color: #1565c0; } .status-success { background: #e8f5e8; color: #2e7d32; } .status-error { background: #ffebee; color: #c62828; }
    .connected-state { text-align: center; }
`}</style>); }

function MainApp() { return (<><CustomStyles /><App /></>); }
export default MainApp;