import React, { useState, useEffect } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
import {
    PrivateKey,
    AccountId,
    Client,
    TokenAssociateTransaction,
    AccountAllowanceApproveTransaction,
    NftId,
} from '@hashgraph/sdk';

import {
    getProvider,
    getEscrowContractWithSigner,
    assetTokenId,
    escrowContractAddress,
    escrowContractAccountId,
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
  const [serialNumber, setSerialNumber] = useState(null);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);


  // --- Check for an existing wallet on load ---
  useEffect(() => {
    const loadWallet = async () => {
      const storedKey = localStorage.getItem('integro-private-key');
      const storedAccountId = localStorage.getItem('integro-account-id');
      const storedTokenId = localStorage.getItem('integro-token-id');
      const storedSerialNumber = localStorage.getItem('integro-serial-number');
      const storedFlowState = localStorage.getItem('integro-flow-state');

      if (storedKey && storedAccountId) {
        setStatus("Restoring your secure vault...");
        const provider = getProvider();
        // IMPORTANT: Always prefix the raw private key with '0x' for ethers.js
        const loadedSigner = new ethers.Wallet("0x" + storedKey, provider);
        setSigner(loadedSigner);
        setAccountId(storedAccountId);
        if (storedTokenId) setTokenId(storedTokenId);
        if (storedSerialNumber) setSerialNumber(storedSerialNumber);
        if (storedFlowState) setFlowState(storedFlowState);
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
      // 1. Generate new ED25519 keys on the device
      const newPrivateKey = PrivateKey.generateED25519();
      const newPublicKey = newPrivateKey.publicKey;
      const newPrivateKeyRaw = newPrivateKey.toStringRaw();

      // 2. Call our backend to create the account on Hedera
      setStatus("2/3: Calling the Account Factory...");
      const response = await fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: newPublicKey.toStringRaw() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Backend request failed.');
      }
      const newAccountId = data.accountId;
      setStatus(`2/3: Account ${newAccountId} created by factory.`);

      // 3. Save everything and create the signer
      setStatus("3/3: Saving credentials and creating signer...");
      localStorage.setItem('integro-private-key', newPrivateKeyRaw);
      localStorage.setItem('integro-account-id', newAccountId);

      const provider = getProvider();
      const newSigner = new ethers.Wallet("0x" + newPrivateKeyRaw, provider);

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
    if (!accountId) return alert("Account not initialized.");
    setIsTransactionLoading(true);
    setStatus("🚀 Minting RWA NFT...");

    let client;
    try {
      // --- 1. Associate Token (Hedera SDK) ---
      setStatus("⏳ 1/3: Associating token with your account...");

      const storedKey = localStorage.getItem('integro-private-key');
      if (!storedKey) throw new Error("Private key not found in localStorage.");

      const userPrivateKey = PrivateKey.fromStringED25519(storedKey);
      const userAccountId = AccountId.fromString(accountId);

      client = Client.forTestnet();
      client.setOperator(userAccountId, userPrivateKey);

      const associateTx = new TokenAssociateTransaction()
        .setAccountId(userAccountId)
        .setTokenIds([assetTokenId])
        .freezeWith(client);

      const associateSign = await associateTx.sign(userPrivateKey);
      const associateSubmit = await associateSign.execute(client);
      const associateRx = await associateSubmit.getReceipt(client);

      if (associateRx.status.toString() !== 'SUCCESS') {
        throw new Error(`Token Association Failed: ${associateRx.status.toString()}`);
      }
      console.log(`- NFT association with account ${accountId}: ${associateRx.status.toString()}`);
      setStatus("✅ 1/3: Association successful!");


      // --- 2. Call Backend to Mint (Server-Side Logic) ---
      setStatus("⏳ 2/3: Calling secure backend to mint...");
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

      // --- 3. Update State ---
      setStatus("⏳ 3/3: Updating state with new NFT info...");
      const { tokenId: newTokenId, serialNumber: newSerialNumber } = data;
      setTokenId(newTokenId); // This is the 0.0.X ID of the token collection
      setSerialNumber(newSerialNumber); // This is the unique ID of the NFT
      setFlowState("MINTED");

      localStorage.setItem('integro-token-id', newTokenId);
      localStorage.setItem('integro-serial-number', newSerialNumber);
      localStorage.setItem('integro-flow-state', "MINTED");

      setStatus(`✅ NFT Minted! Serial Number: ${newSerialNumber}`);

    } catch (error) {
      console.error("Minting failed:", error);
      // Handle the case where the token is already associated
      if (error.message && error.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
        setStatus("⚠️ Token already associated. Proceeding...");
        // You might want to call the minting part of the function again here
      } else {
        setStatus(`❌ Minting Failed: ${error.message}`);
      }
    } finally {
      if (client) {
        client.close();
      }
      setIsTransactionLoading(false);
    }
  };

  const handleList = async () => {
    if (!signer || !tokenId || !serialNumber) return alert("Please mint an NFT first.");
    setIsTransactionLoading(true);
    setStatus("🚀 Listing NFT for sale...");

    let client;
    try {
        // --- 1. Approve Escrow Contract (Hedera SDK) ---
        setStatus("⏳ 1/2: Approving Escrow contract via HTS...");

        const storedKey = localStorage.getItem('integro-private-key');
        if (!storedKey) throw new Error("Private key not found in localStorage.");
        const userPrivateKey = PrivateKey.fromStringED25519(storedKey);
        const userAccountId = AccountId.fromString(accountId);

        client = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

        const nftId = new NftId(AccountId.fromString(tokenId), serialNumber);

        const approveTx = new AccountAllowanceApproveTransaction()
            .approveTokenNftAllowance(nftId, userAccountId, escrowContractAccountId)
            .freezeWith(client);

        const approveSign = await approveTx.sign(userPrivateKey);
        const approveSubmit = await approveSign.execute(client);
        const approveRx = await approveSubmit.getReceipt(client);

        if (approveRx.status.toString() !== 'SUCCESS') {
            throw new Error(`HTS Approval Failed: ${approveRx.status.toString()}`);
        }
        console.log(`- HTS approval for Escrow contract ${escrowContractAccountId}: ${approveRx.status.toString()}`);
        setStatus("✅ 1/2: HTS Approval successful!");


        // --- 2. List on Marketplace (ethers.js) ---
        setStatus("⏳ 2/2: Listing on EVM marketplace...");
        const userEscrowContract = getEscrowContractWithSigner(signer);
        const priceInTinybars = BigInt(50 * 1e8); // 50 HBAR
        const tokenSolidityAddress = AccountId.fromString(tokenId).toSolidityAddress();

        const listTx = await userEscrowContract.listAsset(tokenSolidityAddress, serialNumber, priceInTinybars);
        await listTx.wait();

        setFlowState("LISTED");
        localStorage.setItem('integro-flow-state', "LISTED");
        setStatus(`✅ NFT Listed for 50 HBAR!`);

    } catch (error) {
        console.error("Listing failed:", error);
        setStatus(`❌ Listing Failed: ${error.message}`);
    } finally {
        if (client) {
            client.close();
        }
        setIsTransactionLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!signer || !tokenId || !serialNumber || flowState !== 'LISTED') {
      alert("Prerequisites not met. Ensure an NFT is listed for sale.");
      return;
    }
    setIsTransactionLoading(true);
    setStatus("🚀 Buying NFT (Funding Escrow)...");
    try {
      const userEscrowContract = getEscrowContractWithSigner(signer);
      const tokenSolidityAddress = AccountId.fromString(tokenId).toSolidityAddress();
      const priceInWei = ethers.parseEther("50");

      console.log(`Funding Escrow with Token Address: ${tokenSolidityAddress}, Serial: ${serialNumber}`);

      const txResponse = await userEscrowContract.fundEscrow(
        tokenSolidityAddress,
        serialNumber,
        {
          value: priceInWei,
          gasLimit: 1000000
        }
      );
      await txResponse.wait();

      setFlowState("FUNDED");
      localStorage.setItem('integro-flow-state', "FUNDED");
      setStatus(`✅ Escrow Funded! Ready for delivery confirmation.`);

    } catch (error) {
      console.error("Purchase failed:", error);
      setStatus(`❌ Purchase Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!signer || !tokenId || !serialNumber) return alert("No funded escrow to confirm.");
    setIsTransactionLoading(true);
    setStatus("🚀 Confirming Delivery...");
    try {
      const userEscrowContract = getEscrowContractWithSigner(signer);
      const tokenSolidityAddress = AccountId.fromString(tokenId).toSolidityAddress();

      const confirmTx = await userEscrowContract.confirmDelivery(tokenSolidityAddress, serialNumber, {
        gasLimit: 1000000,
      });
      await confirmTx.wait();

      setFlowState("SOLD");
      localStorage.setItem('integro-flow-state', "SOLD");
      setStatus(`🎉 SALE COMPLETE! NFT Transferred & Seller Paid.`);

    } catch (error) {
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