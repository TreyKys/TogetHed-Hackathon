import React, { useState, useEffect } from 'react';
import './App.css';
import {
  getClientForAccount,
  ESCROW_CONTRACT_ACCOUNT_ID,
  ASSET_TOKEN_ID,
  TokenAssociateTransaction,
  AccountAllowanceApproveTransaction,
  TokenId,
  NftId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractCallQuery,
  Hbar,
  AccountId,
  PrivateKey,
} from './hedera.js';
import {
  saveMintedAssetToFirestore,
  saveListingToFirestore,
  updateListingStateInFirestore,
  writeTxToFirestore,
  transferAssetOwnerInFirestore
} from './firestoreHelpers.js';


// ⚠️ ACTION REQUIRED: Replace this placeholder with your real deployed function URL
const cloudFunctionUrl = "https://createaccount-cehqwvb4aq-uc.a.run.app";
const mintRwaViaUssdUrl = "https://mintrwaviaussd-cehqwvb4aq-uc.a.run.app";

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
    const loadWallet = async () => {
      const storedKey = localStorage.getItem('integro-private-key');
      const storedAccountId = localStorage.getItem('integro-account-id');
      const storedEvmAddress = localStorage.getItem('integro-evm-address');

      if (storedKey && storedAccountId && storedEvmAddress) {
        try {
          setStatus("Restoring your secure vault...");

          console.log("Wallet details found in localStorage. Restoring session.");

          setAccountId(storedAccountId);
          setEvmAddress(storedEvmAddress);
          setStatus(`✅ Vault restored. Welcome back, ${storedAccountId}`);

        } catch (error) {
          console.error("Failed to load wallet on startup:", error);
          setStatus("❌ Could not restore vault. Please create a new one.");
          localStorage.clear(); // Clear all vault-related data
        }
      }
    };
    loadWallet();
  }, []);

  // --- Create a new wallet via the Account Factory ---
  const handleCreateVault = async () => {
    setIsProcessing(true);
    try {
      setStatus("Generating keys & calling Account Factory...");
      // The frontend should post the public key only if you generate keys here.
      // Assuming frontend does NOT generate private key - keep your existing pattern.
      const response = await fetch(cloudFunctionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ /* if you send publicKey, send it here */ })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "createAccount failed");
      const { accountId, privateKey, evmAddress } = data;
      localStorage.setItem("integro-account-id", accountId);
      localStorage.setItem("integro-private-key", privateKey);
      localStorage.setItem("integro-evm-address", evmAddress || "");

      // Minimal client-side validation
      const client = getClientForAccount(accountId, privateKey);

      // TODO: store profile skeleton in Firestore via helper...

      setAccountId(accountId);
      setEvmAddress(evmAddress);
      setStatus(`Vault created: ${accountId}`);
    } catch (err) {
      console.error("Vault creation failed:", err);
      setStatus(`Vault creation failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMint = async () => {
    setIsTransactionLoading(true);
    try {
      const accountId = localStorage.getItem("integro-account-id");
      const privateKey = localStorage.getItem("integro-private-key");
      if (!accountId || !privateKey) throw new Error("Vault missing");

      const resp = await fetch(mintRwaViaUssdUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          assetType: "Yam Harvest Future",
          quality: "Grade A",
          location: "Ikorodu, Nigeria"
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "mint failed");

      const { tokenId, serialNumber } = data;
      // Persist canonical minted asset in Firestore
      await saveMintedAssetToFirestore({ tokenId, serialNumber, owner: accountId });
      setAssetTokenIdState(tokenId);
      setNftSerialNumber(serialNumber);
      setFlowState("MINTED");
      setStatus(`NFT minted: ${serialNumber}`);
    } catch (err) {
      console.error("Minting failed:", err);
      setStatus(`Mint failed: ${err.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleList = async (priceInHBAR) => {
    setIsTransactionLoading(true);
    try {
      const storedKey = localStorage.getItem("integro-private-key");
      const storedAccountId = localStorage.getItem("integro-account-id");
      if (!storedKey || !storedAccountId) throw new Error("Vault missing");
      if (!assetTokenIdState || nftSerialNumber == null) throw new Error("No NFT to list");

      // 1) Native SDK NFT allowance approval (as you already do)
      const client = getClientForAccount(storedAccountId, storedKey);
      const tokenIdObj = TokenId.fromString(assetTokenIdState);
      const nftIdObj = new NftId(tokenIdObj, Number(nftSerialNumber));
      const allowanceTx = new AccountAllowanceApproveTransaction()
        .approveTokenNftAllowance(nftIdObj, AccountId.fromString(storedAccountId), ESCROW_CONTRACT_ACCOUNT_ID)
        .freezeWith(client);
      const signedAllowance = await allowanceTx.signWithOperator(client);
      const allowanceResp = await (await signedAllowance.execute(client)).getReceipt(client);
      if (allowanceResp.status.toString() !== "SUCCESS") throw new Error("Approval failed");

      // 2) Convert priceInHBAR (float/number) to tinybars string
      // priceInHBAR should be number like 50 (HBAR)
      const priceTinybarsStr = String(Math.round(priceInHBAR * 1e8)); // careful: no float math for large numbers in production; use BigInt if needed

      // 3) Contract call to list
      const tx = await new ContractExecuteTransaction()
        .setContractId(ESCROW_CONTRACT_ACCOUNT_ID)
        .setGas(300000)
        .setFunction("listAsset", new ContractFunctionParameters()
          .addUint256(BigInt(nftSerialNumber)) // tokenId/serial as uint256
          .addUint256(BigInt(priceTinybarsStr)) // price in tinybars
        )
        .execute(client);

      const receipt = await tx.getReceipt(client);
      if (receipt.status.toString() !== "SUCCESS") throw new Error("listAsset failed");

      // 4) Persist listing in Firestore (canonical from on-chain)
      await saveListingToFirestore({
        tokenId: assetTokenIdState,
        serialNumber: nftSerialNumber,
        seller: storedAccountId,
        priceTinybars: priceTinybarsStr,
        contractTxId: tx.transactionId.toString()
      });

      setFlowState("LISTED");
      setStatus("Listed successfully!");
    } catch (err) {
      console.error("Listing failed:", err);
      setStatus(`Listing failed: ${err.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleBuy = async () => {
    setIsTransactionLoading(true);
    try {
      const storedKey = localStorage.getItem("integro-private-key");
      const storedAccountId = localStorage.getItem("integro-account-id");
      if (!storedKey || !storedAccountId) throw new Error("Vault missing");
      if (!assetTokenIdState || nftSerialNumber == null) throw new Error("Missing NFT details");

      const client = getClientForAccount(storedAccountId, storedKey);

      // 1) Read canonical listing on-chain (do not use Firestore)
      const callQuery = new ContractCallQuery()
        .setContractId(ESCROW_CONTRACT_ACCOUNT_ID)
        .setGas(200000)
        .setFunction("listings", new ContractFunctionParameters().addUint256(BigInt(nftSerialNumber)));
      const result = await callQuery.execute(client);

      const priceTinybarsStr = result.getUint256(2).toString(); // index 2 = price
      const stateNum = Number(result.getUint256(3).toString()); // index 3 = state
      if (stateNum !== 0) throw new Error("Escrow: Asset is not listed for sale.");

      // 2) Convert tinybars to Hbar and execute fundEscrow with setPayableAmount
      const payableHbar = Hbar.fromTinybars(priceTinybarsStr);
      const tx = await new ContractExecuteTransaction()
        .setContractId(ESCROW_CONTRACT_ACCOUNT_ID)
        .setGas(300000)
        .setFunction("fundEscrow", new ContractFunctionParameters().addUint256(BigInt(nftSerialNumber)))
        .setPayableAmount(payableHbar)
        .execute(client);

      // 3) Wait for receipt & verify success
      const receipt = await tx.getReceipt(client);
      if (receipt.status.toString() !== "SUCCESS") throw new Error("Funding failed: " + receipt.status.toString());

      // 4) Persist payment to Firestore and mark listing as FUNDED (state)
      await writeTxToFirestore({
        txId: tx.transactionId.toString(),
        action: "fundEscrow",
        tokenId: assetTokenIdState,
        serialNumber: nftSerialNumber,
        buyer: storedAccountId,
        paidTinybars: priceTinybarsStr
      });
      await updateListingStateInFirestore(assetTokenIdState, nftSerialNumber, "FUNDED");

      setFlowState("FUNDED");
      setStatus("Escrow funded successfully");
    } catch (err) {
      console.error("Purchase Failed:", err);
      setStatus(`Purchase Failed: ${err.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleConfirm = async () => {
    setIsTransactionLoading(true);
    try {
      const storedKey = localStorage.getItem("integro-private-key");
      const storedAccountId = localStorage.getItem("integro-account-id");
      if (!storedKey || !storedAccountId) throw new Error("Vault missing");
      if (!assetTokenIdState || nftSerialNumber == null) throw new Error("Missing NFT details");

      const client = getClientForAccount(storedAccountId, storedKey);

      const tx = await new ContractExecuteTransaction()
        .setContractId(ESCROW_CONTRACT_ACCOUNT_ID)
        .setGas(400000)
        .setFunction("confirmDelivery", new ContractFunctionParameters().addUint256(BigInt(nftSerialNumber)))
        .execute(client);

      const receipt = await tx.getReceipt(client);
      if (receipt.status.toString() !== "SUCCESS") throw new Error("confirmDelivery failed");

      // update firestone: listing -> SOLD, transfer owner
      await updateListingStateInFirestore(assetTokenIdState, nftSerialNumber, "SOLD");
      await transferAssetOwnerInFirestore(assetTokenIdState, nftSerialNumber, /*buyer:*/ storedAccountId);

      setFlowState("SOLD");
      setStatus("Sale complete! NFT transferred and seller paid");
    } catch (err) {
      console.error("Confirmation Failed:", err);
      setStatus(`Confirmation Failed: ${err.message}`);
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
        <button onClick={() => handleList(50)} className="hedera-button" disabled={isTransactionLoading || flowState !== 'MINTED'}>
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