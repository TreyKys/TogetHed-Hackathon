import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
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
  Hbar,
  AccountBalanceQuery
} from '@hashgraph/sdk';
import { db, collection, addDoc, Timestamp, doc, getDoc, query, where, getDocs, updateDoc, setDoc } from '../firebase';
import {
  escrowContractAccountId,
  assetTokenId,
  lendingPoolContractAccountId,
} from '../hedera.js';
import { getOnchainListing } from '../hedera_helpers.js';

const mintRwaViaUssdUrl = "https://mintrwaviaussd-cehqwvb4aq-uc.a.run.app";

// Create the context
export const WalletContext = createContext(null);

// Create a provider component
// eslint-disable-next-line react-refresh/only-export-components
export const WalletProvider = ({ children }) => {
  const [accountId, setAccountId] = useState(null);
  const [evmAddress, setEvmAddress] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [hbarBalance, setHbarBalance] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [flowState, setFlowState] = useState('INITIAL');
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const [nftSerialNumber, setNftSerialNumber] = useState(null);
  const [status, setStatus] = useState("Welcome. Please create your secure vault.");

  const fetchBalance = useCallback(async (id) => {
    if (!id) return;
    try {
      const client = Client.forTestnet();
      const query = new AccountBalanceQuery().setAccountId(id);
      const accountBalance = await query.execute(client);
      setHbarBalance(accountBalance.hbars.toString());
    } catch (error) {
      console.error("Failed to fetch HBAR balance:", error);
      setHbarBalance("Error");
    }
  }, []);

  const fetchUserProfile = useCallback(async (id) => {
    if (id) {
      console.log("WalletContext: Fetching user profile for", id);
      const userDocRef = doc(db, 'users', id);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const profileData = userDocSnap.data();
        console.log("WalletContext: User profile found.", profileData);
        setUserProfile(profileData);
        if (profileData.profileCompleted) {
          localStorage.setItem('integro-profile-completed', 'true');
        }
      } else {
        console.log("WalletContext: User profile not found.");
        setUserProfile(null);
        // If profile doesn't exist, the local flag should be false
        localStorage.removeItem('integro-profile-completed');
      }
    }
  }, []);

  // On component mount, try to load the wallet from localStorage
  useEffect(() => {
    const loadVaultAndProfile = async () => {
      const storedKey = localStorage.getItem('integro-private-key');
      const storedAccountId = localStorage.getItem('integro-account-id');
      const storedEvmAddress = localStorage.getItem('integro-evm-address');

      if (storedKey && storedAccountId && storedEvmAddress) {
        console.log("WalletContext: Restoring wallet from localStorage.");
        setPrivateKey(storedKey);
        setAccountId(storedAccountId);
        setEvmAddress(storedEvmAddress);
        await fetchBalance(storedAccountId);

        // First, check local flag for speed
        const localProfileFlag = localStorage.getItem('integro-profile-completed');
        if (localProfileFlag === 'true') {
          await fetchUserProfile(storedAccountId, true); // Fetch profile but assume completion
        } else {
          await fetchUserProfile(storedAccountId, false); // Fetch and check for completion
        }
      }
      setIsLoaded(true);
    };

    loadVaultAndProfile();
  }, [fetchBalance, fetchUserProfile]);


  useEffect(() => {
    if (accountId) {
      const interval = setInterval(() => {
        fetchBalance(accountId);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [accountId, fetchBalance]);

  const refreshUserProfile = async () => {
    if (accountId) {
      await fetchUserProfile(accountId);
    }
  };

  // This function will be called by the onboarding flow to set the new vault details
  const createVault = (newAccountId, newPrivateKey, newEvmAddress) => {
    console.log("WalletContext: createVault called with", newAccountId);
    // 1. Save to localStorage
    localStorage.setItem('integro-private-key', newPrivateKey);
    localStorage.setItem('integro-account-id', newAccountId);
    localStorage.setItem('integro-evm-address', newEvmAddress);
    localStorage.removeItem('integro-profile-completed');


    // 2. Update state
    console.log("WalletContext: Setting new accountId:", newAccountId);
    setPrivateKey(newPrivateKey);
    setAccountId(newAccountId);
    setEvmAddress(newEvmAddress);
    fetchUserProfile(newAccountId);
    console.log("WalletContext: State update complete.");
  };

  // This function will allow components to clear the vault
  const logout = () => {
    localStorage.removeItem('integro-private-key');
    localStorage.removeItem('integro-account-id');
    localStorage.removeItem('integro-evm-address');
    localStorage.removeItem('integro-profile-completed');
    setPrivateKey(null);
    setAccountId(null);
    setEvmAddress(null);
    setUserProfile(null);
  };

  const handleTokenAssociation = async () => {
    try {
      const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
      const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
      const userAccountId = AccountId.fromString(accountId);
      const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

      const associateTx = await new TokenAssociateTransaction()
        .setAccountId(userAccountId)
        .setTokenIds([assetTokenId])
        .freezeWith(userClient);

      const associateSign = await associateTx.sign(userPrivateKey);
      const associateSubmit = await associateSign.execute(userClient);
      const associateReceipt = await associateSubmit.getReceipt(userClient);

      if (associateReceipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Token Association Failed with status: ${associateReceipt.status.toString()}`);
      }
    } catch (err) {
      if (!err.message.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
        throw err;
      }
    }
  };

  const handleMint = async (assetType, quality, location) => {
    await handleTokenAssociation();
    const response = await fetch(mintRwaViaUssdUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: accountId,
        assetType,
        quality,
        location
      }),
    });

    const data = await response.json();
    console.log("handleMint: Received data from backend:", data);
    if (!response.ok) {
      console.error("Backend minting request failed. Raw response:", data);
      throw new Error(data.error || 'Backend minting request failed.');
    }

    const { serialNumber } = data;
    setNftSerialNumber(serialNumber);
    setFlowState('MINTED');
    return serialNumber;
  };

  const handleMintAndList = async (listingData) => {
    await handleTokenAssociation();

    const { name, price } = listingData;

    // 1. Mint the NFT via backend
    const mintResponse = await fetch(mintRwaViaUssdUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: accountId,
        assetType: name,
        quality: "N/A",
        location: "N/A",
      }),
    });

    const mintData = await mintResponse.json();
    if (!mintResponse.ok) {
      throw new Error(mintData.error || 'Backend minting request failed.');
    }
    const { serialNumber } = mintData;
    setNftSerialNumber(serialNumber); // Set serial number for handleList
    setFlowState('MINTED');

    // 2. List on-chain
    await handleList(price, serialNumber, listingData);

    return { serialNumber };
  };

  const handleList = async (price, serialToUse, listingData) => {
    const currentSerial = serialToUse || nftSerialNumber;
    // --- Defensive Programming: Check for null values ---
    if (!assetTokenId) {
      console.error("handleList Error: assetTokenId is not set. Please check hedera.js");
      throw new Error("Configuration error: assetTokenId is missing.");
    }
    if (currentSerial === null || currentSerial === undefined) {
      console.error("handleList Error: nftSerialNumber is not set. Minting may have failed.");
      throw new Error("State error: nftSerialNumber is missing.");
    }
    console.log(`handleList: Listing NFT ${assetTokenId} - Serial: ${currentSerial} for price: ${price}`);

    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const userAccountId = AccountId.fromString(accountId);
    const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

    const tokenIdObj = TokenId.fromString(assetTokenId);
    const nftIdObj = new NftId(tokenIdObj, Number(currentSerial));

    const allowanceTx = new AccountAllowanceApproveTransaction()
      .approveTokenNftAllowance(nftIdObj, userAccountId, escrowContractAccountId);

    const frozenTx = await allowanceTx.freezeWith(userClient);
    const signedTx = await frozenTx.sign(userPrivateKey);
    const txResponse = await signedTx.execute(userClient);
    await txResponse.getReceipt(userClient);

    const priceInTinybars = Hbar.from(price).toTinybars();
    const listAssetTx = new ContractExecuteTransaction()
      .setContractId(escrowContractAccountId)
      .setGas(1000000)
      .setFunction("listAsset", new ContractFunctionParameters()
        .addUint256(currentSerial)
        .addUint256(priceInTinybars)
      );

    const frozenListTx = await listAssetTx.freezeWith(userClient);
    const signedListTx = await frozenListTx.sign(userPrivateKey);
    const listTxResponse = await signedListTx.execute(userClient);
    const receipt = await listTxResponse.getReceipt(userClient);

    // After contract listAsset tx receipt shows SUCCESS
    const onchainListing = await getOnchainListing(currentSerial, escrowContractAccountId, accountId, privateKey);
    // Validate that onchainListing.state === 0 (LISTED) and price matches
    if (!onchainListing || onchainListing.state !== 0) {
      throw new Error("Listing not confirmed on-chain after listAsset receipt");
    }

    // Write Firestore doc
    const { name, description, category, imageUrl } = listingData;
    const listingDoc = {
      tokenId: assetTokenId,
      serial: Number(currentSerial),
      name,
      description,
      category,
      imageUrl,
      sellerAccountId: accountId,
      priceTinybars: priceInTinybars.toString(),
      txId: receipt.transactionId ? receipt.transactionId.toString() : null,
      state: "LISTED",
      confirmedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'listings', `${assetTokenId}_${currentSerial}`), listingDoc);


    setFlowState("LISTED");
    return listTxResponse.transactionId.toString();
  };

  const approveNFTForPool = async (serialNumber) => {
    console.log(`approveNFTForPool: Approving NFT ${assetTokenId} - Serial: ${serialNumber} for pool: ${lendingPoolContractAccountId}`);

    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const userAccountId = AccountId.fromString(accountId);
    const client = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

    const tokenIdObj = TokenId.fromString(assetTokenId);
    const nftId = new NftId(tokenIdObj, Number(serialNumber));

    const allowanceTx = new AccountAllowanceApproveTransaction()
      .approveTokenNftAllowance(nftId, userAccountId, lendingPoolContractAccountId)
      .freezeWith(client);

    const signed = await allowanceTx.sign(userPrivateKey);
    const resp = await signed.execute(client);
    const receipt = await resp.getReceipt(client);

    console.log(`- NFT Approval transaction status: ${receipt.status.toString()}`);
    return receipt.status.toString();
  }

  const callTakeLoan = async (tokenId, principal, interest, durationSeconds) => {
    await approveNFTForPool(tokenId);

    const principalTinybars = Hbar.from(principal).toTinybars();
    const interestTinybars = Hbar.from(interest).toTinybars();

    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const userAccountId = AccountId.fromString(accountId);
    const client = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

    const tx = await new ContractExecuteTransaction()
      .setContractId(lendingPoolContractAccountId)
      .setGas(250_000)
      .setFunction("takeLoan",
        new ContractFunctionParameters()
          .addUint256(tokenId)
          .addUint256(principalTinybars.toNumber()) // Convert to number
          .addUint256(interestTinybars.toNumber())  // Convert to number
          .addUint256(durationSeconds)
      )
      .execute(client);

    const receipt = await tx.getReceipt(client);
    if (receipt.status.toString() === 'SUCCESS') {
      await addDoc(collection(db, "loans"), {
        tokenId: Number(tokenId),
        borrowerAccountId: accountId,
        principalTinybars: principalTinybars.toString(),
        interestTinybars: interestTinybars.toString(),
        dueTime: new Date(Date.now() + durationSeconds * 1000),
        state: "ACTIVE",
        createdAt: Timestamp.now()
      });
    }
    return receipt;
  }

  const liquidateLoanAsAdmin = async (tokenId, destAddress) => {
    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const adminPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const adminAccountId = AccountId.fromString(accountId);
    const client = Client.forTestnet().setOperator(adminAccountId, adminPrivateKey);

    const tx = await new ContractExecuteTransaction()
      .setContractId(lendingPoolContractAccountId)
      .setFunction("liquidateLoan", new ContractFunctionParameters()
         .addUint256(tokenId)
         .addAddress(destAddress)
      )
      .setGas(200_000)
      .execute(client);

    const receipt = await tx.getReceipt(client);
    if (receipt.status.toString() === 'SUCCESS') {
      const q = query(collection(db, "loans"), where("tokenId", "==", Number(tokenId)));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        updateDoc(doc.ref, { state: "REPAID" });
      });
    }
    return receipt;
  }

  const depositLiquidityAsAdmin = async (amount) => {
    const amountTinybars = Hbar.from(amount).toTinybars();

    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const adminPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const adminAccountId = AccountId.fromString(accountId);
    const client = Client.forTestnet().setOperator(adminAccountId, adminPrivateKey);

    const tx = await new ContractExecuteTransaction()
      .setContractId(lendingPoolContractAccountId)
      .setFunction("depositLiquidity", new ContractFunctionParameters())
      .setGas(100_000)
      .setPayableAmount(Hbar.fromTinybars(amountTinybars))
      .execute(client);

    const receipt = await tx.getReceipt(client);
    if (receipt.status.toString() === 'SUCCESS') {
      const q = query(collection(db, "loans"), where("tokenId", "==", Number(assetTokenId)));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        updateDoc(doc.ref, { state: "LIQUIDATED" });
      });
    }
    return receipt;
  }

  const callRepayLoan = async (tokenId, repayAmount) => {
    const repayTinybars = Hbar.from(repayAmount).toTinybars();

    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const userAccountId = AccountId.fromString(accountId);
    const client = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

    const tx = await new ContractExecuteTransaction()
      .setContractId(lendingPoolContractAccountId)
      .setGas(250_000)
      .setFunction("repayLoan", new ContractFunctionParameters().addUint256(tokenId))
      .setPayableAmount(Hbar.fromTinybars(repayTinybars))
      .execute(client);

    const receipt = await tx.getReceipt(client);
    return receipt;
  }

  const handleBuy = async (listing) => {
    setIsTransactionLoading(true);
    setStatus("🚀 Initializing purchase...");
    try {
      // 1. Get buyer's credentials from state
      const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
      const buyerPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
      const buyerAccountId = AccountId.fromString(accountId);

      if (!buyerPrivateKey || !buyerAccountId) {
        throw new Error("Buyer wallet not found. Please log in again.");
      }

      // 2. Check on-chain listing details for price and status
      setStatus("🔍 Verifying listing on-chain...");
      const serial = Number(listing.serial);
      const onchain = await getOnchainListing(serial, escrowContractAccountId, accountId, privateKey);

      if (!onchain || Number(onchain.state) !== 0) { // 0 = LISTED
        throw new Error("This asset is no longer listed for sale. Please refresh.");
      }
      const priceTinybars = BigInt(onchain.price);

      // 3. Create and configure the Hedera client
      const client = Client.forTestnet().setOperator(buyerAccountId, buyerPrivateKey);

      // 4. Build the ContractExecuteTransaction
      setStatus("✍️ Preparing transaction...");
      const tx = await new ContractExecuteTransaction()
        .setContractId(escrowContractAccountId)
        .setGas(1_000_000)
        .setFunction("fundEscrow", new ContractFunctionParameters().addUint256(serial))
        .setPayableAmount(Hbar.fromTinybars(priceTinybars.toString()))
        .freezeWith(client);

      // 5. Sign and execute the transaction
      setStatus("Submitting to the network...");
      const signedTx = await tx.sign(buyerPrivateKey);
      const txResponse = await signedTx.execute(client);
      const receipt = await txResponse.getReceipt(client);

      // 6. Check receipt and handle success/failure
      if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Purchase failed with network status: ${receipt.status.toString()}`);
      }

      // 7. Update Firestore on successful transaction
      setStatus("✅ Success! Updating marketplace...");
      await setDoc(doc(db, "listings", `${assetTokenId}_${serial}`), {
        state: "FUNDED",
        buyerAccountId: accountId,
        fundedTxId: txResponse.transactionId?.toString() || null,
        fundedAt: new Date().toISOString()
      }, { merge: true });

      setFlowState("FUNDED");
      setStatus("✅ Escrow Funded! Purchase complete.");

    } catch (err) {
      console.error("Purchase failed:", err);
      setStatus(`❌ Purchase Failed: ${err.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const value = {
    accountId,
    evmAddress,
    privateKey,
    hbarBalance,
    isLoaded,
    userProfile,
    flowState,
    nftSerialNumber,
    status,
    setStatus,
    createVault,
    logout,
    refreshUserProfile,
  handleTokenAssociation,
    handleMint,
    handleList,
    handleMintAndList,
    handleBuy,
    approveNFTForPool,
    callTakeLoan,
    callRepayLoan,
    depositLiquidityAsAdmin,
    liquidateLoanAsAdmin,
    isTransactionLoading,
    setIsTransactionLoading
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook to use the wallet context
// eslint-disable-next-line react-refresh/only-export-components
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
