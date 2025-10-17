import { useEffect, useState } from "react";
import { ethers } from "ethers";
import './App.css';

// Import contract addresses and ABIs
import {
  escrowContractAddress,
  assetTokenContractAddress,
  escrowContractABI,
  assetTokenContractABI,
  getContract
} from "./hedera.js";

// --- WalletConnect & Hedera SDK Imports ---
import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import { Transaction } from "@hashgraph/sdk";


// --- WalletConnect Project ID ---
const projectId = "2798ba475f686a8e0ec83cc2cceb095b";

function App() {
  // --- Wallet & Connection State ---
  const [signClient, setSignClient] = useState(null);
  const [modal, setModal] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [evmAddress, setEvmAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  // --- UI & Loading State ---
  const [status, setStatus] = useState("Initializing...");
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);

  // --- Golden Path State ---
  const [flowState, setFlowState] = useState("INITIAL"); // INITIAL, MINTED, LISTED, FUNDED, SOLD
  const [tokenId, setTokenId] = useState(null);

  // --- Initialize WalletConnect and Ethers.js Provider ---
  useEffect(() => {
    async function initialize() {
      setStatus("Initializing WalletConnect...");
      try {
        const client = await SignClient.init({
          projectId: projectId,
          relayUrl: "wss://relay.walletconnect.com",
          metadata: {
            name: "Integro Marketplace",
            description: "A Real-World Asset Marketplace on Hedera",
            url: window.location.origin,
            icons: [],
          },
        });

        const wcModal = new WalletConnectModal({
          projectId: projectId,
          chains: ["hedera:testnet"],
        });

        // Setup Ethers.js provider for Hedera Testnet
        const hederaProvider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
        setProvider(hederaProvider);

        const onSessionConnect = async (session) => {
          const connectedAccountId = session.namespaces.hedera.accounts[0].split(':')[2];
          setAccountId(connectedAccountId);
          setStatus("⏳ Resolving EVM address...");

          const fetchedEvmAddress = await getEvmAddress(connectedAccountId);
          if (fetchedEvmAddress) {
            setEvmAddress(fetchedEvmAddress);
            const hederaSigner = await hederaProvider.getSigner(fetchedEvmAddress);
            setSigner(hederaSigner);
            setStatus(`✅ Connected as: ${connectedAccountId}`);
          }
        };

        client.on("session_connect", (event) => onSessionConnect(event.params));

        if (client.session.length > 0) {
          const lastSession = client.session.get(client.session.keys.at(-1));
          onSessionConnect(lastSession);
        }

        setSignClient(client);
        setModal(wcModal);
        if(!accountId) setStatus("Ready to connect");
        setIsLoading(false);

      } catch (error) {
        console.error("Initialization failed:", error);
        setStatus(`❌ Init error: ${error.message}`);
        setIsLoading(false);
      }
    }
    initialize();
  }, [accountId]);

  // --- Address Resolution Helper ---
  const getEvmAddress = async (accountId) => {
    try {
      const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`);
      if (!response.ok) {
        throw new Error(`Mirror node query failed with status: ${response.status}`);
      }
      const data = await response.json();
      if (!data.evm_address) {
        throw new Error("EVM address not found for this account. Please ensure it has been activated.");
      }
      return data.evm_address;
    } catch (error) {
      console.error("Could not fetch EVM address:", error);
      setStatus(`❌ ${error.message}`);
      return null;
    }
  };

  // --- WalletConnect Handlers ---
  const handleConnect = async () => {
    if (!signClient || !modal) {
      setStatus("❌ Connector not ready.");
      return;
    }
    setIsLoading(true);
    setStatus("🔄 Requesting session...");

    try {
      const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
          hedera: {
            methods: ["hedera_signAndExecuteTransaction", "hedera_signMessage"],
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
      setStatus(`❌ Connection Failed.`);
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
      setSigner(null);
      setFlowState("INITIAL");
      setTokenId(null);
      setStatus("Ready to connect");
    }
  };

  // --- Golden Path Transaction Handlers ---

  const handleMint = async () => {
    if (!signer) return alert("Please connect wallet first.");
    setIsTransactionLoading(true);
    setStatus("🚀 Minting RWA NFT...");
    try {
      const assetTokenContract = getContract(assetTokenContractAddress, assetTokenContractABI, signer);
      // NOTE: In a real app, the backend/owner would mint. Here, the user does for the demo.
      const tx = await assetTokenContract.safeMint(
        evmAddress, // Use the resolved EVM address
        "Yam Harvest Future",
        "Grade A",
        "Ikorodu, Nigeria"
      );

      // We need to get the token ID from the transaction receipt
      const receipt = await tx.wait();
      const transferEvent = receipt.events?.find(event => event.event === 'Transfer');
      if (!transferEvent) throw new Error("Token ID not found in transaction receipt.");
      
      const mintedTokenId = transferEvent.args.tokenId.toString();
      setTokenId(mintedTokenId);
      setFlowState("MINTED");
      setStatus(`✅ NFT Minted! Token ID: ${mintedTokenId}`);

    } catch (error) {
      console.error("Minting failed:", error);
      setStatus(`❌ Minting Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleList = async () => {
    if (!signer || !tokenId) return alert("Please mint an NFT first.");
    setIsTransactionLoading(true);
    setStatus("🚀 Listing NFT for sale...");
    try {
      const assetTokenContract = getContract(assetTokenContractAddress, assetTokenContractABI, signer);
      const escrowContract = getContract(escrowContractAddress, escrowContractABI, signer);

      // 1. Approve the Escrow contract to manage the NFT
      setStatus("⏳ Approving Escrow contract...");
      const approveTx = await assetTokenContract.approve(escrowContractAddress, tokenId);
      await approveTx.wait();
      setStatus("✅ Approval successful!");

      // 2. List the asset
      setStatus("⏳ Listing on marketplace...");
      // Price is 50 HBAR, represented in 8-decimal tinybars for the contract parameter
      const priceInTinybars = BigInt(50 * 1e8);
      const listTx = await escrowContract.listAsset(tokenId, priceInTinybars);
      await listTx.wait();

      setFlowState("LISTED");
      setStatus(`✅ NFT Listed for 50 HBAR!`);

    } catch (error) {
      console.error("Listing failed:", error);
      setStatus(`❌ Listing Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!signer || !tokenId) return alert("No item listed for sale.");
    // This action would typically be done by a different user (the buyer).
    // For this demo, the same user can be the buyer.
    setIsTransactionLoading(true);
    setStatus("🚀 Buying NFT (Funding Escrow)...");
    try {
      const escrowContract = getContract(escrowContractAddress, escrowContractABI, signer);

      // The `value` sent with the transaction must be in 18-decimal "weibars".
      const priceInWeibars = ethers.utils.parseEther("50");

      const fundTx = await escrowContract.fundEscrow(tokenId, {
        value: priceInWeibars,
        gasLimit: 1000000 // Set a higher gas limit for Hedera contract calls
      });
      await fundTx.wait();
      
      setFlowState("FUNDED");
      setStatus(`✅ Escrow Funded! Ready for delivery confirmation.`);

    } catch (error) {
      console.error("Purchase failed:", error);
      setStatus(`❌ Purchase Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!signer || !tokenId) return alert("No funded escrow to confirm.");
    // This action can be done by the buyer.
    setIsTransactionLoading(true);
    setStatus("🚀 Confirming Delivery...");
    try {
      const escrowContract = getContract(escrowContractAddress, escrowContractABI, signer);
      const confirmTx = await escrowContract.confirmDelivery(tokenId, {
        gasLimit: 1000000 // Higher gas limit
      });
      await confirmTx.wait();

      setFlowState("SOLD");
      setStatus(`🎉 SALE COMPLETE! NFT Transferred & Seller Paid.`);

    } catch (error) {
      console.error("Confirmation failed:", error);
      setStatus(`❌ Confirmation Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };


  return (
    <div className="container">
      <div className="header"><h1>Integro Marketplace</h1><p>The Golden Path Demo</p></div>
      <div className="page-container">
        <div className="card">
          <h3>Wallet Connection</h3>
          <div className={`status-message ${accountId ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
            {status}
          </div>
          {accountId ? (
            <button onClick={handleDisconnect} className="hedera-button disconnect">🚪 Disconnect</button>
          ) : (
            <button onClick={handleConnect} className="hedera-button" disabled={isLoading}>{isLoading ? "🔄 Initializing..." : "🔗 Connect Wallet"}</button>
          )}
        </div>

        {accountId && (
          <div className="card">
            <h3>Golden Path Walkthrough</h3>
            <p className="flow-status">Current State: <strong>{flowState}</strong> {tokenId && `(Token ID: ${tokenId})`}</p>

            <div className="button-group">
              <button onClick={handleMint} className="hedera-button" disabled={isTransactionLoading || flowState !== 'INITIAL'}>
                1. Mint RWA NFT
              </button>
              <button onClick={handleList} className="hedera-button" disabled={isTransactionLoading || flowState !== 'MINTED'}>
                2. List NFT for 50 HBAR
              </button>
              <button onClick={handleBuy} className="hedera-button" disabled={isTransactionLoading || flowState !== 'LISTED'}>
                3. Buy Now (Fund Escrow)
              </button>
              <button onClick={handleConfirm} className="hedera-button" disabled={isTransactionLoading || flowState !== 'FUNDED'}>
                4. Confirm Delivery
              </button>
            </div>

            {flowState === 'SOLD' && (
              <div className="success-message">
                🎉 Congratulations! The entire flow is complete.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomStyles() {
  return (<style>{`
    .container { max-width: 480px; margin: 20px auto; background: #f9f9f9; border-radius: 20px; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1); overflow: hidden; display: flex; flex-direction: column; font-family: Arial, sans-serif;}
    .header { background: linear-gradient(135deg, #1A1A1A, #000000); color: white; padding: 20px; text-align: center; }
    .header h1 { font-size: 28px; margin: 0; }
    .header p { font-size: 12px; opacity: 0.8; margin-top: 4px; }
    .page-container { padding: 20px; }
    .card { background: white; padding: 20px; border-radius: 15px; margin-bottom: 15px;}
    .hedera-button { background: #2DD87F; color: black; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer; width: 100%; margin-top: 10px; font-weight: 600; transition: background 0.3s, opacity 0.3s;}
    .hedera-button:hover:not(:disabled) { background: #25b366; }
    .hedera-button:disabled { background: #cccccc; cursor: not-allowed; opacity: 0.6; }
    .hedera-button.disconnect { background: #ff4444; color: white; }
    .hedera-button.disconnect:hover { background: #cc3333; }
    .status-message { padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center; word-wrap: break-word; }
    .status-info { background: #e3f2fd; color: #1565c0; }
    .status-success { background: #e8f5e8; color: #2e7d32; }
    .status-error { background: #ffebee; color: #c62828; }
    .flow-status { text-align: center; font-size: 14px; color: #333; background-color: #f0f0f0; padding: 8px; border-radius: 8px; margin-bottom: 15px; }
    .button-group button { margin-bottom: 8px; }
    .success-message { text-align: center; padding: 15px; background-color: #e8f5e8; color: #2e7d32; border-radius: 8px; margin-top: 15px; font-weight: bold; }
  `}</style>);
}

function MainApp() { return (<><CustomStyles /><App /></>); }
export default MainApp;