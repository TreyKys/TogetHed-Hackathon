import React, { useState, useEffect } from 'react';
import './App.css';
import { ethers } from 'ethers';
import {
  PrivateKey,
  AccountId,
  Client,
  TokenAssociateTransaction,
  AccountAllowanceApproveTransaction,
  TokenId,
  NftId
} from '@hashgraph/sdk';
import {
  getEscrowContract,
  escrowContractAddress,
  escrowContractAccountId,
  assetTokenId,
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
  const [assetTokenIdState, setAssetTokenIdState] = useState(null);
  const [nftSerialNumber, setNftSerialNumber] = useState(null);
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
    // 1. Load User Credentials
    const storedKey = localStorage.getItem('integro-private-key');
    const storedAccountId = localStorage.getItem('integro-account-id');

    if (!storedKey || !storedAccountId) {
      alert("Vault not found. Please create a vault first.");
      return;
    }
    if (assetTokenId !== "0.0.7130964") {
        alert(`CRITICAL: Incorrect Token ID detected: ${assetTokenId}`);
        return;
    }

    setIsTransactionLoading(true);
    setStatus("🚀 Minting RWA NFT...");

    let userClient;

    try {
      // 2. SDK Token Association
      setStatus("⏳ 1/3: Preparing to associate token with your account...");

      // NOTE: Stored key has '0x' prefix from ethers, SDK needs raw.
      const userPrivateKey = PrivateKey.fromStringECDSA(storedKey.slice(2));
      const userAccountId = AccountId.fromString(storedAccountId);

      userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

      setStatus("⏳ 2/3: Associating token (requires your signature)...");
      const associateTx = await new TokenAssociateTransaction()
        .setAccountId(userAccountId)
        .setTokenIds([assetTokenId])
        .freezeWith(userClient);

      const associateSign = await associateTx.sign(userPrivateKey);
      const associateSubmit = await associateSign.execute(userClient);

      try {
        const associateReceipt = await associateSubmit.getReceipt(userClient);
        if (associateReceipt.status.toString() === 'SUCCESS') {
          setStatus("✅ Association successful! Proceeding to mint...");
          console.log("Token Association Successful!");
        } else {
          // This path may not be hit if getReceipt throws, but is a fallback.
          console.error("ASSOCIATION FAILED:", associateReceipt);
          throw new Error(`Token Association Failed with status: ${associateReceipt.status.toString()}`);
        }
      } catch (err) {
        if (err.message.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
          setStatus("✅ Token already associated. Proceeding to mint...");
          console.log("Token already associated, proceeding to mint.");
        } else {
          // Re-throw other errors
          throw err;
        }
      }


      // 3. Backend Mint Request
      setStatus("⏳ 3/3: Calling secure backend to mint...");
      const response = await fetch(mintRwaViaUssdUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: storedAccountId,
          assetType: "Yam Harvest Future",
          quality: "Grade A",
          location: "Ikorodu, Nigeria"
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Backend minting request failed.');
      }

      // 4. Handle Backend Response
      console.log("Backend Response:", data);
      const { tokenId: receivedTokenId, serialNumber } = data;

      if (receivedTokenId !== assetTokenId) {
          console.warn(`Warning: Token ID from backend (${receivedTokenId}) does not match expected ID (${assetTokenId}).`);
      }

      setAssetTokenIdState(receivedTokenId); // Store the collection ID
      setNftSerialNumber(serialNumber); // Store the unique serial number
      setFlowState('MINTED');
      setStatus(`✅ NFT Minted! Serial Number: ${serialNumber}`);

    } catch (error) {
      console.error("Minting failed:", error);
      setStatus(`❌ Minting Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
      if (userClient) {
        userClient.close();
      }
    }
  };

 const handleList = async () => {

    setIsTransactionLoading(true);
    setStatus("🚀 Listing NFT for sale...");

    try {
      // 2. SDK NFT Approval
      console.log("Step 1: SDK NFT Approval");
      setStatus("⏳ 1/3: Creating SDK client...");

           const userPrivateKey = PrivateKey.fromStringECDSA(PrivateKey);
      const userAccountId = AccountId.fromString(accountId);

      const userClient = Client.forTestnet();
      userClient.setOperator(userAccountId, userPrivateKey);

      setStatus("⏳ 2/3: Building & signing native approval...");
      const allowanceTx = new AccountAllowanceApproveTransaction()
        .approveTokenNftAllowance(new NftId(TokenId.fromString(assetTokenIdState), nftSerialNumber), accountId, escrowContractAccountId);

      const frozenTx = await allowanceTx.freezeWith(userClient);
      const signedTx = await frozenTx.sign(userPrivateKey);
      const txResponse = await signedTx.execute(userClient);
      const receipt = await txResponse.getReceipt(userClient);

      if (receipt.status.toString() !== 'SUCCESS') {
        console.error("Receipt:", JSON.stringify(receipt, null, 2));
        throw new Error(`SDK Approval Failed: ${receipt.status.toString()}`);
      }
      console.log("SDK Approval successful!");
      setStatus("✅ SDK Approval Successful!");

      // 3. Prepare Solidity Call Parameters
      console.log("Step 2: Preparing EVM call parameters");
      setStatus("⏳ 3/3: Preparing to list on marketplace...");
      const tokenSolidityAddress = AccountId.fromString(assetTokenIdState).toSolidityAddress();
      const serialBigInt = BigInt(nftSerialNumber);
      const priceInTinybars = BigInt(50 * 1e8);

      // 4. Call listAsset (Ethers.js)
      console.log("Step 3: Calling listAsset on Escrow contract");
      const escrowContract = getEscrowContract(signer);
      const listTxResponse = await escrowContract.listAsset(
        `0x${tokenSolidityAddress}`,
        serialBigInt,
        priceInTinybars,
        { gasLimit: 1000000 }
      );
      await listTxResponse.wait();

      // 5. Update State
      setFlowState("LISTED");
      setStatus(`✅ NFT Listed for 50 HBAR!`);
      console.log("Listing successful!");

    } catch (error) {
      console.error("Listing failed:", error);
      setStatus(`❌ Listing Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!signer || !nftSerialNumber) return alert("No item listed for sale.");
    setIsTransactionLoading(true);
    setStatus("🚀 Buying NFT (Funding Escrow)...");
    try {
      const userEscrowContract = getEscrowContract(signer);
      const priceInWeibars = ethers.parseEther("50");

      const tokenSolidityAddress = AccountId.fromString(assetTokenIdState).toSolidityAddress();

      const fundTx = await userEscrowContract.fundEscrow(
        `0x${tokenSolidityAddress}`,
        nftSerialNumber,
        {
          value: priceInWeibars,
          gasLimit: 1000000
        }
      );
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
    if (!signer || !nftSerialNumber) return alert("No funded escrow to confirm.");
    setIsTransactionLoading(true);
    setStatus("🚀 Confirming Delivery...");
    try {
      const userEscrowContract = getEscrowContract(signer);
      const tokenSolidityAddress = AccountId.fromString(assetTokenIdState).toSolidityAddress();
      const confirmTx = await userEscrowContract.confirmDelivery(
        `0x${tokenSolidityAddress}`,
        nftSerialNumber,
        {
          gasLimit: 1000000
        }
      );
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
      <p className="flow-status">Current State: <strong>{flowState}</strong> {assetTokenIdState && `(Token ID: ${assetTokenIdState})`}</p>

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