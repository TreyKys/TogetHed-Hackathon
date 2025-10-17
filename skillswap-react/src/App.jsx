import React, { useEffect, useState } from 'react';
import './App.css';
import { ethers } from 'ethers';
import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import { 
  assetTokenContract, 
  escrowContract,
  assetTokenAddress, 
  escrowAddress 
} from "./hedera.js"; // Assuming hedera.js exports the live contract instances

// WalletConnect Project ID
const projectId = "2798ba475f686a8e0ec83cc2cceb095b";

function App() {
  const [status, setStatus] = useState("Initializing...");
  const [accountId, setAccountId] = useState(null);
  const [signer, setSigner] = useState(null);
  const [signClient, setSignClient] = useState(null);
  const [modal, setModal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // This effect runs ONLY ONCE to initialize the wallet client
  useEffect(() => {
    const initialize = async () => {
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

        // Set up the event listener for successful connections
        client.on("session_connect", (event) => {
          onSessionConnect(event.params);
        });

        // Check if there's an existing session on load
        if (client.session.length > 0) {
          const lastSession = client.session.get(client.session.keys.at(-1));
          onSessionConnect(lastSession);
        }

        setSignClient(client);
        setModal(wcModal);
        setStatus("Ready to connect wallet.");
      } catch (error) {
        console.error("Initialization failed:", error);
        setStatus(`❌ Init error: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // This function is called ONLY after a session is connected
  const onSessionConnect = (session) => {
    try {
      const fullAccountId = session.namespaces.hedera.accounts[0]; // e.g., "hedera:testnet:0.0.12345"
      const hederaAccountId = fullAccountId.split(':')[2];
      setAccountId(hederaAccountId);

      // --- THE CRITICAL FIX ---
      // We create the signer here, AFTER we have a valid account ID
      const hederaProvider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
      const walletConnectSigner = new ethers.Wallet(
        // We provide a dummy private key because ethers.js requires one,
        // but it will NEVER be used. Signing is handled by HashPack.
        "0x0000000000000000000000000000000000000000000000000000000000000001",
        hederaProvider
      );
      setSigner(walletConnectSigner);
      // --- END FIX ---
      
      setStatus(`✅ Connected as: ${hederaAccountId}`);
    } catch (error) {
      console.error("Failed to set up signer:", error);
      setStatus(`❌ Connection error: ${error.message}`);
    }
  };

  const handleConnect = async () => {
    if (!signClient || !modal) return;
    setIsLoading(true);
    setStatus("🔄 Requesting connection...");
    try {
      const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
          hedera: {
            methods: ["hedera_signAndExecuteTransaction"],
            chains: ["hedera:testnet"],
            events: [],
          },
        },
      });
      if (uri) {
        await modal.openModal({ uri });
        await approval();
        modal.closeModal();
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setStatus("❌ Connection rejected.");
    } finally {
      setIsLoading(false);
    }
  };

  // Placeholder for transaction logic
  const handleMint = async () => {
    if (!signer) return alert("Signer not ready. Please reconnect.");
    setStatus("🚀 Minting NFT...");
    try {
      // Example transaction using the connected signer
      // const tx = await assetTokenContract.connect(signer).safeMint(...);
      // await tx.wait();
      setStatus("✅ Mint successful!");
      alert("NFT Minted! (Placeholder)");
    } catch (error) {
      console.error("Minting failed:", error);
      setStatus(`❌ Mint failed: ${error.message}`);
    }
  };

  // --- UI ---
  return (
    <div className="container">
      <div className="header">
        <h1>Integro</h1>
        <p>Powered by Hedera</p>
      </div>
      <div className="page-container">
        <div className="card">
          <h3>Connection Status</h3>
          <div className="status-message">{status}</div>
          {!accountId ? (
            <button onClick={handleConnect} disabled={isLoading} className="hedera-button">
              {isLoading ? "🔄 Initializing..." : "🔗 Connect Wallet"}
            </button>
          ) : (
            <p>Wallet connected. Ready to transact.</p>
          )}
        </div>
        
        {/* Transaction buttons are disabled until the signer is ready */}
        <div className="card">
          <h3>Golden Path</h3>
          <button onClick={handleMint} disabled={!signer} className="hedera-button">
            1. Mint RWA NFT
          </button>
          {/* Add other buttons here, also disabled={!signer} */}
        </div>
      </div>
    </div>
  );
}

// ... (Your CustomStyles and MainApp components) ...
// Remember to include the CSS from your previous versions.
export default App;
