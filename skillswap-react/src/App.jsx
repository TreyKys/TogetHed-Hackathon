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

// --- Environment Variables ---
// Using Vite's import.meta.env for environment variables
const MY_ACCOUNT_ID = import.meta.env.VITE_MY_ACCOUNT_ID;
const MY_PRIVATE_KEY = import.meta.env.VITE_MY_PRIVATE_KEY;

function App() {
  // --- Wallet & Connection State ---
  const [signer, setSigner] = useState(null);
  const [provider, setProvider] = useState(null);

  // --- UI & Loading State ---
  const [status, setStatus] = useState("Initializing...");
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);

  // --- Golden Path State ---
  const [flowState, setFlowState] = useState("INITIAL"); // INITIAL, MINTED, LISTED, FUNDED, SOLD
  const [tokenId, setTokenId] = useState(null);

  // --- Initialize Ethers.js Provider & Signer ---
  useEffect(() => {
    async function initialize() {
      setStatus("Initializing Hedera connection...");
      if (!MY_ACCOUNT_ID || !MY_PRIVATE_KEY) {
        setStatus("❌ Environment variables VITE_MY_ACCOUNT_ID and VITE_MY_PRIVATE_KEY must be set.");
        console.error("VITE_MY_ACCOUNT_ID and VITE_MY_PRIVATE_KEY must be set in your .env file.");
        return;
      }

      try {
        const hederaProvider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
        setProvider(hederaProvider);

        // Create a wallet instance from the private key
        const hederaSigner = new ethers.Wallet(MY_PRIVATE_KEY, hederaProvider);
        setSigner(hederaSigner);

        setStatus(`✅ Connected as: ${MY_ACCOUNT_ID}`);
        setFlowState("INITIAL");
      } catch (error) {
        console.error("Initialization failed:", error);
        setStatus(`❌ Init error: ${error.message}`);
      }
    }
    initialize();
  }, []);

  // --- Golden Path Transaction Handlers ---

  const handleMint = async () => {
    if (!signer) return alert("Signer not initialized.");
    setIsTransactionLoading(true);
    setStatus("🚀 Minting RWA NFT...");
    try {
      const assetTokenContract = getContract(assetTokenContractAddress, assetTokenContractABI, signer);
      // Minting the NFT to our own account for the demo
      const tx = await assetTokenContract.safeMint(
        signer.address,
        "Yam Harvest Future",
        "Grade A",
        "Ikorodu, Nigeria"
      );

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

      setStatus("⏳ Approving Escrow contract...");
      const approveTx = await assetTokenContract.approve(escrowContractAddress, tokenId);
      await approveTx.wait();
      setStatus("✅ Approval successful!");

      setStatus("⏳ Listing on marketplace...");
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
    setIsTransactionLoading(true);
    setStatus("🚀 Buying NFT (Funding Escrow)...");
    try {
      const escrowContract = getContract(escrowContractAddress, escrowContractABI, signer);
      const priceInWeibars = ethers.parseEther("50");

      const fundTx = await escrowContract.fundEscrow(tokenId, {
        value: priceInWeibars,
        gasLimit: 1000000
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
    setIsTransactionLoading(true);
    setStatus("🚀 Confirming Delivery...");
    try {
      const escrowContract = getContract(escrowContractAddress, escrowContractABI, signer);
      const confirmTx = await escrowContract.confirmDelivery(tokenId, {
        gasLimit: 1000000
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
      <div className="header"><h1>Integro Marketplace</h1><p>The Golden Path Demo (Direct Signing)</p></div>
      <div className="page-container">
        <div className="card">
          <h3>Connection Status</h3>
          <div className={`status-message ${status.includes('✅') ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
            {status}
          </div>
        </div>

        {signer && (
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

// Styles remain the same
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