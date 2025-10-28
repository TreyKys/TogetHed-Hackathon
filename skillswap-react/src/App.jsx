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
  ContractCallQuery,
  Hbar
} from '@hashgraph/sdk';
import {
  escrowContractAddress,
  escrowContractAccountId,
  assetTokenId,
} from './hedera.js';

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
          const provider = getProvider();

          const normalizedKey = storedKey.startsWith("0x") ? storedKey : "0x" + storedKey;
          // Use ethers directly for ECDSA key — do not convert via Hashgraph PrivateKey
          // We no longer need to create a signer, just load the account info
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
    setStatus("1/2: Calling the secure Account Factory...");
    try {
      // 1. Call our backend to create the account on Hedera
      const response = await fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Backend request failed.');
      }

      const { accountId, privateKey, evmAddress: backendEvm } = data;

      // 2. Save everything to localStorage and update state
      setStatus("2/2: Finalizing your vault...");
      // ensure privateKey is 0x-prefixed
      const normalizedPriv = privateKey.startsWith("0x") ? privateKey : "0x" + privateKey;

      // The backend now returns the canonical EVM address.
      localStorage.setItem('integro-private-key', normalizedPriv);
      localStorage.setItem('integro-account-id', accountId);
      localStorage.setItem('integro-evm-address', backendEvm);

      // set states
      setAccountId(accountId);
      setEvmAddress(backendEvm);


      // Display credentials to user once for backup
      alert(
        `Vault Created Successfully!\n\nPlease back up these details securely:\n
        Account ID: ${accountId}\n
        Private Key: ${normalizedPriv}\n
        EVM Address: ${backendEvm}`
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
      // NOTE: Hedera SDK requires the raw private key *without* the 0x prefix.
      const rawPrivateKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
      const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivateKey);
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
          console.log("Token Association Successful!");
        } else {
          console.error("ASSOCIATION FAILED:", associateReceipt);
          throw new Error(`Token Association Failed with status: ${associateReceipt.status.toString()}`);
        }
      } catch (err) {
        if (err.message.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
          setStatus("✅ Token already associated.");
          console.log("Token already associated.");
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
    // 1. Load User Credentials
    const storedKey = localStorage.getItem('integro-private-key');
    const storedAccountId = localStorage.getItem('integro-account-id');

    if (!storedKey || !storedAccountId) {
      alert("Vault not found. Please create a vault first.");
      return;
    }

    setIsTransactionLoading(true);
    setStatus("🚀 Minting RWA NFT...");

    try {
      // 2. Ensure Token Association (in case it wasn't done during vault creation)
      setStatus("⏳ 1/3: Ensuring token association...");
      await handleTokenAssociation(storedAccountId, storedKey);

      // 3. Backend Mint Request
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
      if (!response.ok) {
        throw new Error(data.error || 'Backend minting request failed.');
      }

      // 4. Handle Backend Response
      console.log("Backend Response:", data);
      const { tokenId: receivedTokenId, serialNumber } = data;

      if (receivedTokenId !== assetTokenId) {
        console.warn(`Warning: Token ID from backend (${receivedTokenId}) does not match expected ID (${assetTokenId}).`);
      }

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
      if (!storedKey) throw new Error('No private key found in localStorage.');

      // 1. SDK NFT Approval
      console.log("Step 1: SDK NFT Approval");
      setStatus("⏳ 1/3: Creating SDK client...");

      // NOTE: Hedera SDK requires the raw private key *without* the 0x prefix.
      const rawPrivateKey = storedKey.startsWith("0x") ? storedKey.slice(2) : storedKey;
      const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivateKey);

      if (!accountId) throw new Error('No accountId available in state.');
      const userAccountId = AccountId.fromString(accountId);

      const userClient = Client.forTestnet();
      userClient.setOperator(userAccountId, userPrivateKey);

      setStatus("⏳ 2/3: Building & signing native approval...");

      if (!assetTokenIdState) throw new Error('No assetTokenIdState set.');
      if (nftSerialNumber == null) throw new Error('No nftSerialNumber set.');

      const tokenIdObj = TokenId.fromString(assetTokenIdState);
      const nftIdObj = new NftId(tokenIdObj, Number(nftSerialNumber));

      const allowanceTx = new AccountAllowanceApproveTransaction()
        .approveTokenNftAllowance(nftIdObj, userAccountId, escrowContractAccountId);

      const frozenTx = await allowanceTx.freezeWith(userClient);
      const signedTx = await frozenTx.sign(userPrivateKey);
      const txResponse = await signedTx.execute(userClient);
      const receipt = await txResponse.getReceipt(userClient);

      if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error(`SDK Approval Failed: ${receipt.status.toString()}`);
      }
      console.log("SDK Approval successful!");
      setStatus("✅ SDK Approval Successful!");

      // 2. Prepare and Execute Contract Call
      console.log("Step 2: Preparing EVM call parameters");
      setStatus("⏳ 3/3: Preparing to list on marketplace...");

      // The user enters the price in HBAR, and we convert it to the smallest unit (tinybars)
      // The contract will treat this value as wei.
      const priceInHbar = 50;
      const priceInWei = Hbar.from(priceInHbar).toTinybars();
      console.log(`Listing NFT for ${priceInHbar} HBAR, which is ${priceInWei.toString()} in the smallest unit (tinybars/wei).`);

      const listAssetTx = new ContractExecuteTransaction()
        .setContractId(escrowContractAccountId)
        .setGas(1000000) // Adjust gas as needed
        .setFunction("listAsset", new ContractFunctionParameters()
          .addUint256(nftSerialNumber)
          .addUint256(priceInWei) // Pass the price in the native unit
        );

      const frozenListTx = await listAssetTx.freezeWith(userClient);
      const signedListTx = await frozenListTx.sign(userPrivateKey);
      const listTxResponse = await signedListTx.execute(userClient);
      const listReceipt = await listTxResponse.getReceipt(userClient);

      if (listReceipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Native listAsset call failed: ${listReceipt.status.toString()}`);
      }

      // 3. Update State
      setFlowState("LISTED");
      setStatus(`✅ NFT Listed for 50 HBAR!`);
      console.log("Listing successful!");

    } catch (error) {
      console.error("Listing failed:", error);
      const currentAddress = signer ? await signer.getAddress() : "null";
      setStatus(`❌ Listing Failed: ${error.message} (Signer: ${currentAddress})`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!accountId || !nftSerialNumber) return alert("No item listed for sale.");
    setIsTransactionLoading(true);
    setStatus("🚀 Buying NFT (Funding Escrow)...");
    try {
      const storedKey = localStorage.getItem('integro-private-key');
      if (!storedKey) throw new Error('No private key found in localStorage.');

      // Setup client
      const rawPrivateKey = storedKey.startsWith("0x") ? storedKey.slice(2) : storedKey;
      const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivateKey);
      const userAccountId = AccountId.fromString(accountId);
      const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);
      console.log("[handleBuy] Client created for buyer:", userAccountId.toString());

      // 1. Get the exact listing price from the contract
      console.log("[handleBuy] Step 1: Fetching listing price for serial #", nftSerialNumber);
      const getPriceQuery = new ContractCallQuery()
        .setContractId(escrowContractAccountId)
        .setGas(100000) // Gas for a view function is typically low
        .setFunction("getListingPrice", new ContractFunctionParameters().addUint256(nftSerialNumber));

      const priceQueryResult = await getPriceQuery.execute(userClient);
      const priceInWei = priceQueryResult.getUint256(0);
      console.log(`[handleBuy] Contract returned price: ${priceInWei.toString()} in the smallest unit (tinybars/wei).`);

      if (priceInWei.isZero()) {
        throw new Error("Could not retrieve a valid price for this NFT. It may not be listed.");
      }

      const payableAmount = Hbar.fromTinybars(priceInWei);
      console.log(`[handleBuy] Payable amount calculated: ${payableAmount.toString()}`);

      // 2. Create and execute the funding transaction with the exact price
      console.log("[handleBuy] Step 2: Building and sending the fundEscrow transaction...");
      const fundTx = new ContractExecuteTransaction()
        .setContractId(escrowContractAccountId)
        .setGas(1000000)
        .setPayableAmount(payableAmount)
        .setFunction("fundEscrow", new ContractFunctionParameters()
          .addUint256(nftSerialNumber)
        );

      const frozenFundTx = await fundTx.freezeWith(userClient);
      const signedFundTx = await frozenFundTx.sign(userPrivateKey);
      console.log("[handleBuy] Transaction signed by buyer.");
      const fundTxResponse = await signedFundTx.execute(userClient);
      console.log("[handleBuy] Transaction submitted. TX ID:", fundTxResponse.transactionId.toString());

      console.log("[handleBuy] Awaiting transaction receipt...");
      const fundReceipt = await fundTxResponse.getReceipt(userClient);
      console.log("[handleBuy] Receipt received. Status:", fundReceipt.status.toString());

      if (fundReceipt.status.toString() !== 'SUCCESS') {
        console.error("[handleBuy] Full receipt:", JSON.stringify(fundReceipt, null, 2));
        throw new Error(`Native fundEscrow call failed: ${fundReceipt.status.toString()}`);
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
    if (!accountId || !nftSerialNumber) return alert("No funded escrow to confirm.");
    setIsTransactionLoading(true);
    setStatus("🚀 Confirming Delivery...");
    try {
      const storedKey = localStorage.getItem('integro-private-key');
      if (!storedKey) throw new Error('No private key found in localStorage.');

      // Setup client
      const rawPrivateKey = storedKey.startsWith("0x") ? storedKey.slice(2) : storedKey;
      const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivateKey);
      const userAccountId = AccountId.fromString(accountId);
      const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);
      console.log("[handleConfirm] Client created for buyer:", userAccountId.toString());

      // Create and execute transaction
      console.log("[handleConfirm] Building and sending the confirmDelivery transaction for serial #", nftSerialNumber);
      const confirmTx = new ContractExecuteTransaction()
        .setContractId(escrowContractAccountId)
        .setGas(1000000)
        .setFunction("confirmDelivery", new ContractFunctionParameters()
          .addUint256(nftSerialNumber)
        );

      const frozenConfirmTx = await confirmTx.freezeWith(userClient);
      const signedConfirmTx = await frozenConfirmTx.sign(userPrivateKey);
      console.log("[handleConfirm] Transaction signed by buyer.");
      const confirmTxResponse = await signedConfirmTx.execute(userClient);
      console.log("[handleConfirm] Transaction submitted. TX ID:", confirmTxResponse.transactionId.toString());

      console.log("[handleConfirm] Awaiting transaction receipt...");
      const confirmReceipt = await confirmTxResponse.getReceipt(userClient);
      console.log("[handleConfirm] Receipt received. Status:", confirmReceipt.status.toString());


      if (confirmReceipt.status.toString() !== 'SUCCESS') {
        console.error("[handleConfirm] Full receipt:", JSON.stringify(confirmReceipt, null, 2));
        throw new Error(`Native confirmDelivery call failed: ${confirmReceipt.status.toString()}`);
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