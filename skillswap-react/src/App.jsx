import React, { useState, useEffect } from 'react';
import './App.css';
import {
  PrivateKey,
  AccountId,
  Client,
  TokenAssociateTransaction,
  AccountAllowanceApproveTransaction,
  TokenId,
  NftId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar
} from '@hashgraph/sdk';
import {
  escrowContractAccountId,
  assetTokenId
} from './hedera.js';

// ⚠️ ACTION REQUIRED: Replace this placeholder with your real deployed function URL
const cloudFunctionUrl = "https://createaccount-cehqwvb4aq-uc.a.run.app";
const mintRwaViaUssdUrl = "https://mintrwaviaussd-cehqwvb4aq-uc.a.run.app";

// --- Helper function for delays ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function App() {
  const [status, setStatus] = useState("Welcome. Please create your secure vault.");
  const [isProcessing, setIsProcessing] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [evmAddress, setEvmAddress] = useState(null);
  const [flowState, setFlowState] = useState('INITIAL');
  const [assetTokenIdState, setAssetTokenIdState] = useState(null);
  const [nftSerialNumber, setNftSerialNumber] = useState(null);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);

  // --- Check for an existing wallet on load ---
  useEffect(() => {
    const loadWallet = () => {
      const storedKey = localStorage.getItem('integro-private-key');
      const storedAccountId = localStorage.getItem('integro-account-id');
      const storedEvmAddress = localStorage.getItem('integro-evm-address');

      if (storedKey && storedAccountId && storedEvmAddress) {
        try {
          setStatus("Restoring your secure vault...");
          setAccountId(storedAccountId);
          setEvmAddress(storedEvmAddress);
          setStatus(`✅ Vault restored. Welcome back, ${storedAccountId}`);
        } catch (error) {
          console.error("Failed to load wallet on startup:", error);
          setStatus("❌ Could not restore vault. Please create a new one.");
          localStorage.clear();
        }
      }
    };
    loadWallet();
  }, []);

  // --- Create a new wallet via the Account Factory ---
  const handleCreateVault = async () => {
    setIsProcessing(true);
    setStatus("1/2: Calling the secure Account Factory...");
    try {
      const response = await fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Backend request failed.');
      }

      const { accountId, privateKey, evmAddress } = data;

      setStatus("2/2: Finalizing your vault...");
      localStorage.setItem('integro-private-key', privateKey);
      localStorage.setItem('integro-account-id', accountId);
      localStorage.setItem('integro-evm-address', evmAddress);

      setAccountId(accountId);
      setEvmAddress(evmAddress);

      alert(
        `Vault Created Successfully!\n\nPlease back up these details securely:\n
        Account ID: ${accountId}\n
        Private Key: ${privateKey}\n
        EVM Address: ${evmAddress}`
       );

      setStatus(`✅ Secure vault created! Your Account ID: ${accountId}`);

    } catch (error) {
      console.error("Vault creation failed:", error);
      setStatus(`❌ Vault creation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Token Association Function ---
  const handleTokenAssociation = async (accountId, privateKey) => {
    try {
      const userPrivateKey = PrivateKey.fromStringECDSA(privateKey);
      const userAccountId = AccountId.fromString(accountId);
      const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

      setStatus("⏳ Associating token with your account...");
      const associateTx = await new TokenAssociateTransaction()
        .setAccountId(userAccountId)
        .setTokenIds([assetTokenId])
        .freezeWith(userClient);

      const associateSign = await associateTx.sign(userPrivateKey);
      const associateSubmit = await associateSign.execute(userClient);

      try {
        const associateReceipt = await associateSubmit.getReceipt(userClient);
        if (associateReceipt.status.toString() === 'SUCCESS') {
          setStatus("✅ Token association successful!");
        } else {
          throw new Error(`Token Association Failed with status: ${associateReceipt.status.toString()}`);
        }
      } catch (err) {
        if (err.message.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
          setStatus("✅ Token already associated.");
        } else {
          throw err;
        }
      }

      userClient.close();
    } catch (error) {
      console.error("Token association failed:", error);
      throw error;
    }
  };

  const handleMint = async () => {
    const storedKey = localStorage.getItem('integro-private-key');
    const storedAccountId = localStorage.getItem('integro-account-id');
    if (!storedKey || !storedAccountId) return alert("Vault not found.");

    setIsTransactionLoading(true);
    setStatus("🚀 Minting RWA NFT...");

    try {
      setStatus("⏳ 1/3: Ensuring token association...");
      await handleTokenAssociation(storedAccountId, storedKey);

      setStatus("⏳ 2/3: Calling secure backend to mint...");
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
      if (!response.ok) throw new Error(data.error || 'Backend minting failed.');

      const { tokenId: receivedTokenId, serialNumber } = data;
      setAssetTokenIdState(receivedTokenId);
      setNftSerialNumber(serialNumber);
      setFlowState('MINTED');
      setStatus(`✅ NFT Minted! Serial Number: ${serialNumber}`);

    } catch (error) {
      console.error("Minting failed:", error);
      setStatus(`❌ Minting Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleList = async () => {
    setIsTransactionLoading(true);
    setStatus("🚀 Listing NFT for sale...");

    try {
      const storedKey = localStorage.getItem('integro-private-key');
      const storedAccountId = localStorage.getItem('integro-account-id');
      if (!storedKey || !storedAccountId) throw new Error('Vault credentials not found.');
      if (!assetTokenIdState || nftSerialNumber == null) throw new Error('NFT data not found in state.');

      const userPrivateKey = PrivateKey.fromStringECDSA(storedKey);
      const userAccountId = AccountId.fromString(storedAccountId);
      const client = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

      // 1. Native HTS Approval for the Escrow Contract
      setStatus("⏳ 1/2: Approving marketplace...");
      const tokenIdObj = TokenId.fromString(assetTokenIdState);
      const nftIdObj = new NftId(tokenIdObj, Number(nftSerialNumber));
      const allowanceTx = new AccountAllowanceApproveTransaction()
        .approveTokenNftAllowance(nftIdObj, userAccountId, escrowContractAccountId);
      const frozenTx = await allowanceTx.freezeWith(client);
      const signedTx = await frozenTx.sign(userPrivateKey);
      const txResponse = await signedTx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error(`SDK Approval Failed: ${receipt.status.toString()}`);
      }
      setStatus("✅ Marketplace approved! Waiting for propagation...");

      // Add a delay to allow for network propagation
      await sleep(10000);

      // 2. Call the `listAsset` function on the smart contract
      setStatus("⏳ 2/2: Listing on marketplace...");
      const listTx = new ContractExecuteTransaction()
          .setContractId(escrowContractAccountId)
          .setGas(300000)
          .setFunction("listAsset", new ContractFunctionParameters()
              .addUint256(Number(nftSerialNumber))
              .addUint256(50 * 1e8) // Price in Tinybars (50 HBAR)
          )
          .freezeWith(client);

      const listTxSigned = await listTx.sign(userPrivateKey);
      const listTxResponse = await listTxSigned.execute(client);
      const listReceipt = await listTxResponse.getReceipt(client);

      if (listReceipt.status.toString() !== 'SUCCESS') {
          throw new Error(`Listing transaction failed: ${listReceipt.status.toString()}`);
      }

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
    if (nftSerialNumber == null) return alert("No item listed for sale.");
    setIsTransactionLoading(true);
    setStatus("🚀 Buying NFT (Funding Escrow)...");

    try {
        const storedKey = localStorage.getItem('integro-private-key');
        const storedAccountId = localStorage.getItem('integro-account-id');
        if (!storedKey || !storedAccountId) throw new Error('Vault credentials not found.');

        const userPrivateKey = PrivateKey.fromStringECDSA(storedKey);
        const userAccountId = AccountId.fromString(storedAccountId);
        const client = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

        const fundTx = new ContractExecuteTransaction()
            .setContractId(escrowContractAccountId)
            .setGas(300000)
            .setPayableAmount(new Hbar(50)) // Set the payable amount
            .setFunction("fundEscrow", new ContractFunctionParameters()
                .addUint256(Number(nftSerialNumber))
            )
            .freezeWith(client);

        const fundTxSigned = await fundTx.sign(userPrivateKey);
        const fundTxResponse = await fundTxSigned.execute(client);
        const fundReceipt = await fundTxResponse.getReceipt(client);

        if (fundReceipt.status.toString() !== 'SUCCESS') {
            throw new Error(`Funding transaction failed: ${fundReceipt.status.toString()}`);
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
    if (nftSerialNumber == null) return alert("No funded escrow to confirm.");
    setIsTransactionLoading(true);
    setStatus("🚀 Confirming Delivery...");

    try {
        const storedKey = localStorage.getItem('integro-private-key');
        const storedAccountId = localStorage.getItem('integro-account-id');
        if (!storedKey || !storedAccountId) throw new Error('Vault credentials not found.');

        const userPrivateKey = PrivateKey.fromStringECDSA(storedKey);
        const userAccountId = AccountId.fromString(storedAccountId);
        const client = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

        const confirmTx = new ContractExecuteTransaction()
            .setContractId(escrowContractAccountId)
            .setGas(300000)
            .setFunction("confirmDelivery", new ContractFunctionParameters()
                .addUint256(Number(nftSerialNumber))
            )
            .freezeWith(client);

        const confirmTxSigned = await confirmTx.sign(userPrivateKey);
        const confirmTxResponse = await confirmTxSigned.execute(client);
        const confirmReceipt = await confirmTxResponse.getReceipt(client);

        if (confirmReceipt.status.toString() !== 'SUCCESS') {
            throw new Error(`Confirmation transaction failed: ${confirmReceipt.status.toString()}`);
        }

        setFlowState("SOLD");
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
      <button onClick={handleCreateVault} className="hedera-button" disabled={isProcessing}>
        {isProcessing ? "Creating..." : "Create Your Secure Vault"}
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