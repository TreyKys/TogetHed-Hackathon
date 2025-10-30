import React, { createContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  PrivateKey,
  AccountId,
  Client,
  TokenAssociateTransaction,
  AccountAllowanceApproveTransaction,
  TokenId,
  NftId,
  AccountBalanceQuery
} from '@hashgraph/sdk';
import {
  addDoc,
  collection,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  getEscrowContract,
  escrowContractAddress,
  escrowContractAccountId,
  assetTokenId,
  getProvider,
  assetTokenContractAddress
} from '../hedera.js';

// ⚠️ ACTION REQUIRED: Replace this placeholder with your real deployed function URL
const cloudFunctionUrl = "https://createaccount-cehqwvb4aq-uc.a.run.app";
const mintRwaViaUssdUrl = "https://mintrwaviaussd-cehqwvb4aq-uc.a.run.app";

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [status, setStatus] = useState("Welcome. Please create your secure vault.");
  const [isProcessing, setIsProcessing] = useState(false);
  const [signer, setSigner] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [evmAddress, setEvmAddress] = useState(null);
  const [flowState, setFlowState] = useState('INITIAL');
  const [assetTokenIdState, setAssetTokenIdState] = useState(null);
  const [nftSerialNumber, setNftSerialNumber] = useState(null);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // --- Balance Fetching Function ---
  const fetchBalance = async (accountIdToQuery) => {
    if (!accountIdToQuery) return;
    try {
      const client = Client.forTestnet(); // No operator needed for queries
      const query = new AccountBalanceQuery().setAccountId(accountIdToQuery);
      const accountBalance = await query.execute(client);
      setWalletBalance(accountBalance.hbars.toString());
      console.log(`Balance for ${accountIdToQuery}: ${accountBalance.hbars.toString()} HBAR`);
    } catch (error) {
      console.error("Failed to fetch wallet balance:", error);
      // Don't set status here to avoid overriding other messages
    }
  };


  // --- Check for an existing wallet on load ---
  useEffect(() => {
    const loadWallet = async () => {
      setIsRestoring(true);
      const storedKey = localStorage.getItem('integro-private-key');
      const storedAccountId = localStorage.getItem('integro-account-id');
      const storedEvmAddress = localStorage.getItem('integro-evm-address');

      if (storedKey && storedAccountId && storedEvmAddress) {
        try {
          setStatus("Restoring your secure vault...");
          const provider = getProvider();

          const normalizedKey = storedKey.startsWith("0x") ? storedKey : "0x" + storedKey;
          // Use ethers directly for ECDSA key — do not convert via Hashgraph PrivateKey
          const loadedSigner = new ethers.Wallet(normalizedKey, provider);
          const loadedEvm = await loadedSigner.getAddress();

          console.log("Signer correctly initialized on load with address:", loadedEvm);

          setSigner(loadedSigner);
          setAccountId(storedAccountId);
          setEvmAddress(storedEvmAddress || loadedEvm);
          setStatus(`✅ Vault restored. Welcome back, ${storedAccountId.slice(0, 5)}...`);

          // Fetch balance on load and set up auto-refresh
          fetchBalance(storedAccountId);
          const intervalId = setInterval(() => fetchBalance(storedAccountId), 30000);

          // Cleanup interval on component unmount
          return () => clearInterval(intervalId);

        } catch (error) {
          console.error("Failed to load wallet on startup:", error);
          setStatus("❌ Could not restore vault. Please create a new one.");
          localStorage.clear();
        } finally {
          setIsRestoring(false);
        }
      } else {
        setIsRestoring(false);
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

      // create ethers signer from the returned ECDSA private key
      const provider = getProvider();
      const newSigner = new ethers.Wallet(normalizedPriv, provider);

      // derive address client-side and compare to backendEvm for sanity
      const derivedEvm = await newSigner.getAddress();
      if (backendEvm && backendEvm.toLowerCase() !== derivedEvm.toLowerCase()) {
        console.warn("createVault: backend evm differs from derived evm:", backendEvm, derivedEvm);
        // prefer derivedEvm as canonical
      }

      localStorage.setItem('integro-private-key', normalizedPriv);
      localStorage.setItem('integro-account-id', accountId);
      localStorage.setItem('integro-evm-address', derivedEvm);

      // set states
      setSigner(newSigner);
      setAccountId(accountId);
      setEvmAddress(derivedEvm);

      // Fetch initial balance
      fetchBalance(accountId);

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
      // NOTE: Use PrivateKey.fromString directly, no slicing needed
      const userPrivateKey = PrivateKey.fromString(privateKey);
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

  const handleMint = async (productDetails) => {
    // 1. Load User Credentials
    const storedKey = localStorage.getItem('integro-private-key');
    const storedAccountId = localStorage.getItem('integro-account-id');

    if (!storedKey || !storedAccountId) {
      alert("Vault not found. Please create a vault first.");
      return;
    }

    // Verify we're using the correct token ID
    if (assetTokenId !== "0.0.7134449") {
      alert(`CRITICAL: Incorrect Token ID detected: ${assetTokenId}`);
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

      // --- 5. Save Listing to Firestore ---
      setStatus("⏳ 3/3: Publishing to live marketplace...");
      await addDoc(collection(db, "listings"), {
        tokenId: receivedTokenId,
        serialNumber: serialNumber,
        name: productDetails.productName,
        description: productDetails.description,
        price: Number(productDetails.price),
        category: "General", // Placeholder category
        sellerAccountId: storedAccountId,
        sellerEvmAddress: evmAddress,
        imageUrl: "", // Placeholder for image URL
        createdAt: Timestamp.now(),
      });

      setFlowState('MINTED');
      setStatus(`✅ NFT Minted & Listed! Serial: ${serialNumber}`);

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

      // If signer is null or mismatch, reconstruct it here
      const normalizedKey = storedKey.startsWith("0x") ? storedKey : "0x" + storedKey;
      let usedSigner = signer;
      if (!usedSigner) {
        console.warn("handleList: signer was null, reconstructing from localStorage");
        usedSigner = new ethers.Wallet(normalizedKey, getProvider());
        setSigner(usedSigner); // Update the state with the reconstructed signer
      }

      // Use reconstructed signer reference to be sure
      const signerAddress = await usedSigner.getAddress();

      if (signerAddress.toLowerCase() !== evmAddress.toLowerCase()) {
        throw new Error(`CRITICAL: Signer address (${signerAddress}) does not match stored EVM address (${evmAddress})`);
      }
      console.log("handleList Checkpoint: Using verified Signer Address:", signerAddress);
      setStatus(`Debug: handleList using signer ${signerAddress.slice(0, 8)}...`);

      // 1. SDK NFT Approval
      console.log("Step 1: SDK NFT Approval");
      setStatus("⏳ 1/3: Creating SDK client...");

      // NOTE: Use PrivateKey.fromString for server-generated key
      const userPrivateKey = PrivateKey.fromString(storedKey);

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

      // 2. Prepare Solidity Call Parameters
      console.log("Step 2: Preparing EVM call parameters");
      setStatus("⏳ 3/3: Preparing to list on marketplace...");
      const serialBigInt = BigInt(nftSerialNumber);
      const priceInTinybars = BigInt(50 * 1e8);

      // 3. Call listAsset (Ethers.js) using the already verified signer
      console.log("handleList Checkpoint: About to call listAsset with signer address:", await signer.getAddress());

      const escrowContract = getEscrowContract(signer);
      const listTxResponse = await escrowContract.listAsset(
        serialBigInt,
        priceInTinybars,
        { gasLimit: 1000000 }
      );
      await listTxResponse.wait();

      // 4. Update State
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

  const handleBuy = async (listing) => {
    if (!signer) return alert("Please connect your wallet first.");
    setIsTransactionLoading(true);
    setStatus(`🚀 Buying "${listing.name}"...`);
    try {
      const userEscrowContract = getEscrowContract(signer);
      const priceInHbar = ethers.parseUnits(listing.price.toString(), 8); // HBAR has 8 decimal places

      const fundTx = await userEscrowContract.fundEscrow(
        listing.serialNumber,
        {
          value: priceInHbar,
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
      const confirmTx = await userEscrowContract.confirmDelivery(
        nftSerialNumber,
        {
          gasLimit: 1000000
        }
      );
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
    <WalletContext.Provider value={{
      status,
      isProcessing,
      signer,
      accountId,
      evmAddress,
      flowState,
      assetTokenIdState,
      nftSerialNumber,
      isTransactionLoading,
      walletBalance,
      isRestoring,
      handleCreateVault,
      handleMint,
      handleList,
      handleBuy,
      handleConfirm
    }}>
      {children}
    </WalletContext.Provider>
  );
};
