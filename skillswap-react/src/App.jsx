import React, { useState, useEffect } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { PrivateKey } from '@hashgraph/sdk';
import {
  getAssetTokenContract,
  getEscrowContract,
  escrowContractAddress,
  getProvider
} from './hedera.js';

// ⚠️ ACTION REQUIRED: Replace this placeholder with your real deployed function URL
const cloudFunctionUrl = "https://createaccount-cehqwvb4aq-uc.a.run.app";
const mintRwaViaUssdUrl = "https://mintrwaviaussd-cehqwvb4aq-uc.a.run.app";

function App() {
  const [status, setStatus] = useState("Welcome. Please create your secure vault.");
  const [isProcessing, setIsProcessing] = useState(false);
  const [signer, setSigner] = useState(null);
  const [accountId, setAccountId] = useState(null);
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
        const provider = getProvider();
        const loadedSigner = new ethers.Wallet(storedKey, provider);
        setSigner(loadedSigner);
        setAccountId(storedAccountId);
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

      // 4. Add a delay for network propagation
      setStatus("⏳ Finalizing account on the network (approx. 5 seconds)...");
      await new Promise(resolve => setTimeout(resolve, 5000));

      const provider = getProvider();
      const newSigner = new ethers.Wallet(newPrivateKeyHex, provider);

      setSigner(newSigner);
      setAccountId(newAccountId);

      setStatus(`✅ Secure vault created! Your new Account ID: ${newAccountId}`);
    } catch (error) {
      console.error("Vault creation failed:", error);
      setStatus(`❌ Vault creation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMint = async () => {
    if (!signer || !accountId) return alert("Signer not initialized.");
    setIsTransactionLoading(true);
    setStatus("🚀 Minting RWA NFT...");
    try {
      // Step 1: Associate the token with the user's account (client-side)
      setStatus("⏳ 1/2: Associating token with your account...");
      try {
        const userAssetTokenContract = getAssetTokenContract(signer);
        const assocTx = await userAssetTokenContract.associate({ gasLimit: 1_000_000 });
        await assocTx.wait();
        setStatus("✅ Association successful!");
      } catch (e) {
        // This is a workaround. The contract reverts with a generic "HTS association failed"
        // for multiple reasons, including if the token is already associated.
        // We'll optimistically assume the association is already in place and proceed.
        // The backend mint call will fail if the association is truly missing.
        console.warn("Association transaction failed, proceeding anyway. This may be because the token is already associated.", e);
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
      setStatus(`✅ Mint transaction sent! Hash: ${transactionHash}. Verifying on-chain...`);

      // --- Poll to confirm token existence ---
      const userAssetTokenContract = getAssetTokenContract(); // Read-only instance
      const maxRetries = 15; // 30 seconds timeout
      let retries = 0;
      let isTokenConfirmed = false;

      while (retries < maxRetries) {
        try {
          console.log(`Polling attempt #${retries + 1}: Checking owner of tokenId ${mintedTokenId}. Expecting owner: ${signer.address}`);
          const owner = await userAssetTokenContract.ownerOf(mintedTokenId);
          if (owner.toLowerCase() === signer.address.toLowerCase()) {
            console.log(`SUCCESS: Token ${mintedTokenId} confirmed on-chain for owner ${owner}`);
            isTokenConfirmed = true;
            break;
          } else {
            // This case is important - the token exists but has the wrong owner.
            console.warn(`Token ${mintedTokenId} found, but owner is ${owner}, not ${signer.address}.`);
          }
        } catch (error) {
          // This catch block will be hit if the token doesn't exist yet (e.g., ownerOf reverts)
          console.log(`Polling attempt #${retries + 1}: ownerOf(${mintedTokenId}) reverted. Token likely not propagated yet. Retrying in 2s...`);
        }
        retries++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!isTokenConfirmed) {
        throw new Error("Could not verify the minted NFT on the network. Please try again later.");
      }

      setFlowState("MINTED");
      setStatus(`✅ Ready to List! Token ID: ${mintedTokenId}`);

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
      const userAssetTokenContract = getAssetTokenContract(signer);
      const userEscrowContract = getEscrowContract(signer);

      setStatus("⏳ Approving Escrow contract...");
      // Hedera's estimateGas can be unreliable and fail with "unknown custom error".
      // We'll provide a generous, fixed gasLimit to bypass estimation and ensure the transaction succeeds.
      const approveTx = await userAssetTokenContract.approve(escrowContractAddress, tokenId, { gasLimit: 2_000_000 });
      await approveTx.wait();
      setStatus("✅ Approval successful!");

      setStatus("⏳ Listing on marketplace...");
      const priceInTinybars = BigInt(50 * 1e8); // 50 HBAR
      const listTx = await userEscrowContract.listAsset(tokenId, priceInTinybars, { gasLimit: 2_000_000 });
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
      const userEscrowContract = getEscrowContract(signer);
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
      const userEscrowContract = getEscrowContract(signer);
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