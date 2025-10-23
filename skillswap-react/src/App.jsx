import React, { useState, useEffect } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { PrivateKey, AccountId } from '@hashgraph/sdk';
import {
  getAssetTokenContract,
  getEscrowContract,
  escrowContractAddress,
  assetTokenContractAddress,
  assetTokenContractABI,
  escrowContractABI,
  getProvider,
  toEvmAddress,
  executeContractFunction
} from './hedera.js';

// ⚠️ ACTION REQUIRED: Replace this placeholder with your real deployed function URL
const cloudFunctionUrl = "https://createaccount-cehqwvb4aq-uc.a.run.app";
const mintRwaViaUssdUrl = "https://mintrwaviaussd-cehqwvb4aq-uc.a.run.app";

function App() {
  const [status, setStatus] = useState("Welcome. Please create your secure vault.");
  const [isProcessing, setIsProcessing] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [accountEvmAddress, setAccountEvmAddress] = useState(null);
  const [flowState, setFlowState] = useState('INITIAL');
  const [tokenId, setTokenId] = useState(null);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);

  // --- Check for an existing wallet on load ---
  useEffect(() => {
    const loadWallet = async () => {
      const storedKey = localStorage.getItem('integro-private-key');
      const storedAccountId = localStorage.getItem('integro-account-id');
      if (storedKey && storedAccountId) {
        setStatus("Restoring your secure vault...");
        const accountEvmAddress = toEvmAddress(storedAccountId);
        setAccountId(storedAccountId);
        setAccountEvmAddress(accountEvmAddress);
        setStatus(`✅ Vault restored. Welcome back, ${storedAccountId}`);
      }
    };
    loadWallet();
  }, []);

  // --- Create a new wallet via the Account Factory ---
  const handleCreateVault = async () => {
    setIsProcessing(true);
    setStatus("1/3: Generating secure keys on your device...");
    try {
      // 1. Generate new keys on the device
      const newPrivateKey = PrivateKey.generateECDSA();
      const newPrivateKeyHex = `0x${newPrivateKey.toStringRaw()}`;
      const newPublicKey = newPrivateKey.publicKey.toStringRaw();

      // 2. Call our backend to create the account on Hedera
      setStatus("2/3: Calling the Account Factory...");
      const response = await fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: newPublicKey }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Backend request failed.');
      }
      const newAccountId = data.accountId;

      // 3. Save everything and create the signer
      setStatus("3/3: Finalizing your vault...");
      localStorage.setItem('integro-private-key', newPrivateKeyHex);
      localStorage.setItem('integro-account-id', newAccountId);

      // 4. Poll for account funding to ensure propagation
      const provider = getProvider();
      const expectedEvmAddress = toEvmAddress(newAccountId);
      let balance = BigInt(0);
      const maxRetries = 15;
      const retryDelay = 2000; // 2 seconds

      for (let i = 0; i < maxRetries; i++) {
        try {
          balance = await provider.getBalance(expectedEvmAddress);
          if (balance > BigInt(0)) {
            break; // Exit loop if balance is found
          }
        } catch (e) {
          // Ignore errors and retry
        }
        setStatus(`(Attempt ${i + 1}/${maxRetries}) Waiting for account funding and propagation...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      if (balance === BigInt(0)) {
        throw new Error("Account was not funded by the factory after multiple attempts.");
      }

      setAccountId(newAccountId);
      setAccountEvmAddress(toEvmAddress(newAccountId)); // Convert and store EVM address

      setStatus(`✅ Secure vault created! Your new Account ID: ${newAccountId}`);
    } catch (error) {
      console.error("Vault creation failed:", error);
      setStatus(`❌ Vault creation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMint = async () => {
    if (!accountId) return alert("Account not initialized.");
    setIsTransactionLoading(true);
    setStatus("🚀 Minting RWA NFT...");
    try {
      // Step 1: Associate the token with the user's account (client-side)
      setStatus("⏳ 1/2: Associating token with your account...");
      const privateKey = localStorage.getItem('integro-private-key');
      try {
        const assocReceipt = await executeContractFunction(
          accountId,
          privateKey,
          assetTokenContractAddress,
          assetTokenContractABI,
          "associate",
          [],
          1_000_000
        );
        if (assocReceipt.status.toString() === 'SUCCESS') {
          setStatus("✅ Association successful!");
        } else {
          throw new Error(`Association failed with status: ${assocReceipt.status}`);
        }
      } catch (error) {
        // This is an optimistic workaround. The call often fails if already associated.
        console.warn("Association transaction failed, proceeding anyway.", error);
        setStatus("⚠️ Association failed or skipped. Proceeding to mint...");
      }

      // Step 2: Call the backend to mint the token (server-side)
      setStatus("⏳ 2/2: Calling secure backend to mint...");
      const response = await fetch(mintRwaViaUssdUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: accountId,
          assetType: "Yam Harvest Future",
          quality: "Grade A",
          location: "Ikorodu, Nigeria"
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Backend minting request failed.');
      }

      const { tokenId: mintedTokenId, transactionHash } = data;
      setTokenId(mintedTokenId);
      setStatus(`✅ Mint transaction sent! Hash: ${transactionHash}. Verifying ownership...`);

      // --- Restore Verification Polling ---
      const userAssetTokenContract = getAssetTokenContract(); // Read-only provider
      const expectedOwner = toEvmAddress(accountId);
      let isOwner = false;
      const maxRetries = 10;
      const retryDelay = 3000; // 3 seconds

      for (let i = 0; i < maxRetries; i++) {
        try {
          const onChainOwner = await userAssetTokenContract.ownerOf(mintedTokenId);
          if (onChainOwner.toLowerCase() === expectedOwner.toLowerCase()) {
            isOwner = true;
            break;
          }
        } catch (e) {
          // Ignore errors (e.g., token not found yet) and retry
        }
        setStatus(`(Attempt ${i + 1}/${maxRetries}) Verifying token ownership on-chain...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      if (!isOwner) {
        throw new Error("Could not verify token ownership on-chain after multiple attempts.");
      }
      // --- End Verification Polling ---

      setFlowState("MINTED");
      setStatus(`✅ Ownership Confirmed! Ready to List. Token ID: ${mintedTokenId}`);

    } catch (error) {
      console.error("Minting failed:", error);
      setStatus(`❌ Minting Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleList = async () => {
    if (!accountId || !tokenId) return alert("Please mint an NFT first.");
    setIsTransactionLoading(true);
    setStatus("🚀 Listing NFT for sale...");
    try {
      const privateKey = localStorage.getItem('integro-private-key');

      // --- Approval via Helper ---
      setStatus("⏳ 1/2: Approving marketplace for all your tokens...");
      const approvalReceipt = await executeContractFunction(
        accountId,
        privateKey,
        assetTokenContractAddress,
        assetTokenContractABI,
        "setApprovalForAll",
        [escrowContractAddress, true],
        1_000_000
      );
      if (approvalReceipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Marketplace approval failed with status: ${approvalReceipt.status}`);
      }
      setStatus("✅ Marketplace approved! Verifying on-chain...");

      // --- Approval Verification Polling ---
      const userAssetTokenContract = getAssetTokenContract(); // Read-only
      let isApproved = false;
      const maxRetries = 10;
      const retryDelay = 2000; // 2 seconds

      for (let i = 0; i < maxRetries; i++) {
        try {
          isApproved = await userAssetTokenContract.isApprovedForAll(accountEvmAddress, escrowContractAddress);
          if (isApproved) {
            break;
          }
        } catch (e) {
          // Ignore errors and retry
        }
        setStatus(`(Attempt ${i + 1}/${maxRetries}) Verifying approval on-chain...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      if (!isApproved) {
        throw new Error("Could not verify marketplace approval on-chain after multiple attempts.");
      }
      // --- End Approval Verification Polling ---

      // --- Listing via Helper ---
      setStatus("⏳ 2/2: Listing on marketplace...");
      const priceInTinybars = 50 * 1e8; // 50 HBAR
      const listingReceipt = await executeContractFunction(
        accountId,
        privateKey,
        escrowContractAddress,
        escrowContractABI,
        "listAsset",
        [tokenId, priceInTinybars],
        2_000_000
      );
       if (listingReceipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Listing failed with status: ${listingReceipt.status}`);
      }

      setFlowState("LISTED");
      setStatus(`✅ NFT Listed for 50 HBAR!`);

    } catch (error) {
      console.error("Listing failed:", JSON.stringify(error, null, 2));
      setStatus(`❌ Listing Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!accountId || !tokenId) return alert("No item listed for sale.");
    setIsTransactionLoading(true);
    setStatus("🚀 Buying NFT (Funding Escrow)...");
    try {
      const privateKey = localStorage.getItem('integro-private-key');
      const priceInTinybars = BigInt(50 * 1e8);

      const fundReceipt = await executeContractFunction(
        accountId,
        privateKey,
        escrowContractAddress,
        escrowContractABI,
        "fundEscrow",
        [tokenId],
        1_000_000,
        { value: priceInTinybars }
      );

       if (fundReceipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Funding failed with status: ${fundReceipt.status}`);
      }

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
    if (!accountId || !tokenId) return alert("No funded escrow to confirm.");
    setIsTransactionLoading(true);
    setStatus("🚀 Confirming Delivery...");
    try {
      const privateKey = localStorage.getItem('integro-private-key');
      const confirmReceipt = await executeContractFunction(
        accountId,
        privateKey,
        escrowContractAddress,
        escrowContractABI,
        "confirmDelivery",
        [tokenId],
        1_000_000
      );

      if (confirmReceipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Confirmation failed with status: ${confirmReceipt.status}`);
      }

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

  const handleVerifyOwner = async () => {
    if (!tokenId || !signer) return;
    setStatus("🔍 Verifying ownership on-chain...");
    try {
      const userAssetTokenContract = getAssetTokenContract(); // Read-only
      const owner = await userAssetTokenContract.ownerOf(tokenId);
      setStatus(`✅ On-chain owner: ${owner}. Your address: ${accountEvmAddress}. Match: ${owner.toLowerCase() === accountEvmAddress.toLowerCase()}`);
    } catch (error) {
      console.error("Verification failed:", error);
      setStatus(`❌ Verification failed. The token may not exist on-chain yet.`);
    }
  };

  const renderLoggedInUI = () => (
    <div className="card">
      <h3>Golden Path Walkthrough</h3>
      <p className="flow-status">Current State: <strong>{flowState}</strong> {tokenId && `(Token ID: ${tokenId})`}</p>

      <div className="button-group">
        <button onClick={handleMint} className="hedera-button" disabled={isTransactionLoading || flowState !== 'INITIAL'}>
          1. Mint RWA NFT
        </button>
        {flowState === 'MINTED' && (
          <button onClick={handleVerifyOwner} className="hedera-button verify-button">
            Manually Verify Ownership
          </button>
        )}
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

        {accountId ? renderLoggedInUI() : renderLoggedOutUI()}

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