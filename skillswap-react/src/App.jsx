import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { PrivateKey } from "@hashgraph/sdk";
import './App.css';

// Import functions and contracts from hedera.js
import {
    getProvider,
    assetTokenContract,
    escrowContract,
    escrowContractAddress
} from "./hedera.js";

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

  // --- Initialize Provider and Check for Vault ---
  useEffect(() => {
    const hederaProvider = getProvider();
    setProvider(hederaProvider);
    setStatus("Checking for your secure vault...");

    const storedKey = localStorage.getItem('integro-private-key');
    if (storedKey) {
      console.log("Found existing key in localStorage.");
      try {
        const hederaSigner = new ethers.Wallet(storedKey, hederaProvider);
        setSigner(hederaSigner);
        setStatus(`✅ Vault loaded. Connected as: ${hederaSigner.address}`);
      } catch (error) {
          console.error("Failed to load wallet from stored key:", error);
          setStatus("❌ Error loading vault. Please create a new one.");
          localStorage.removeItem('integro-private-key'); // Clear corrupted key
      }
    } else {
      console.log("No key found in localStorage.");
      setStatus("👋 Welcome! Please create a secure vault to begin.");
    }
  }, []);

  // --- Vault Creation ---
  const handleCreateVault = async () => {
    setStatus("🔐 Creating your secure vault...");
    try {
      // Generate a new Hedera-compatible ECDSA private key
      const newPrivateKey = PrivateKey.generateECDSA();
      const newPrivateKeyHex = `0x${newPrivateKey.toStringRaw()}`;

      // Save to localStorage (simulating a secure enclave)
      localStorage.setItem('integro-private-key', newPrivateKeyHex);

      // Create a new signer
      const hederaSigner = new ethers.Wallet(newPrivateKeyHex, provider);
      setSigner(hederaSigner);

      setStatus(`✅ Vault created! Your new address: ${hederaSigner.address}`);
      console.log("New vault created and stored in localStorage.");
    } catch (error) {
        console.error("Vault creation failed:", error);
        setStatus(`❌ Vault Creation Failed: ${error.message}`);
    }
  };

  // --- Golden Path Transaction Handlers (Refactored) ---

  const handleMint = async () => {
    if (!signer) return alert("Signer not initialized.");
    setIsTransactionLoading(true);
    setStatus("🚀 Minting RWA NFT...");
    try {
      const userAssetTokenContract = assetTokenContract.connect(signer);
      const tx = await userAssetTokenContract.safeMint(
        signer.address,
        "Yam Harvest Future",
        "Grade A",
        "Ikorodu, Nigeria",
        {
            gasLimit: 1000000 // Adding a generous gas limit to bypass estimation issues
        }
      );

      const receipt = await tx.wait();

      // Ethers v6 event parsing: Find the Transfer event log and parse it
      const transferEventInterface = new ethers.Interface(assetTokenContract.abi);
      const transferEventLog = receipt.logs.find(log => {
          try {
              const parsedLog = transferEventInterface.parseLog(log);
              return parsedLog?.name === "Transfer";
          } catch (error) {
              return false;
          }
      });

      if (!transferEventLog) throw new Error("Token ID not found in transaction receipt: Transfer event not found.");

      const parsedLog = transferEventInterface.parseLog(transferEventLog);
      const mintedTokenId = parsedLog.args.tokenId.toString();
      setTokenId(mintedTokenId);
      setFlowState("MINTED");
      setStatus(`✅ NFT Minted! Token ID: ${mintedTokenId}`);

    } catch (error) {
      console.error("Minting failed:", error);
      if (error.code === 'INSUFFICIENT_FUNDS') {
          setStatus(`❌ Minting Failed: Insufficient HBAR balance. Please fund this address on the Hedera Testnet: ${signer.address}`);
      } else {
          setStatus(`❌ Minting Failed: ${error.message}`);
      }
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleList = async () => {
    if (!signer || !tokenId) return alert("Please mint an NFT first.");
    setIsTransactionLoading(true);
    setStatus("🚀 Listing NFT for sale...");
    try {
      const userAssetTokenContract = assetTokenContract.connect(signer);
      const userEscrowContract = escrowContract.connect(signer);

      setStatus("⏳ Approving Escrow contract...");
      const approveTx = await userAssetTokenContract.approve(escrowContractAddress, tokenId);
      await approveTx.wait();
      setStatus("✅ Approval successful!");

      setStatus("⏳ Listing on marketplace...");
      const priceInTinybars = BigInt(50 * 1e8); // 50 HBAR
      const listTx = await userEscrowContract.listAsset(tokenId, priceInTinybars);
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
      const userEscrowContract = escrowContract.connect(signer);
      const priceInWeibars = ethers.parseEther("50");

      const fundTx = await userEscrowContract.fundEscrow(tokenId, {
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
      const userEscrowContract = escrowContract.connect(signer);
      const confirmTx = await userEscrowContract.confirmDelivery(tokenId, {
        gasLimit: 1000000
      });
      await confirmTx.wait();

      setFlowState("SOLD");
      setStatus(`🎉 SALE COMPLETE! NFT Transferred & Seller Paid.`);

    } catch (error)      {
      console.error("Confirmation failed:", error);
      setStatus(`❌ Confirmation Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  // --- UI Rendering ---

  const renderLoggedOutUI = () => (
    <div className="card">
      <h3>Welcome to the Future of RWAs</h3>
      <p>Create a secure, seedless vault to manage your digital assets on Hedera.</p>
      <button onClick={handleCreateVault} className="hedera-button">
        Create Your Secure Vault
      </button>
    </div>
  );

  const renderLoggedInUI = () => (
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
  );

  return (
    <div className="container">
      <div className="header"><h1>Integro Marketplace</h1><p>The "DID Identity Layer" Demo</p></div>
      <div className="page-container">
        <div className="card">
          <h3>Connection Status</h3>
          <div className={`status-message ${status.includes('✅') ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
            {status}
          </div>
        </div>

        {signer ? renderLoggedInUI() : renderLoggedOutUI()}

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
