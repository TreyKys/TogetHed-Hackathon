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
  AccountBalanceQuery,
  ContractCallQuery
} from '@hashgraph/sdk';
import { db, collection, addDoc, Timestamp, doc, getDoc, query, where, getDocs, updateDoc, setDoc, runTransaction } from '../firebase';
import { canonicalSerial, listingDocId } from '../firestoreHelpers';
import {
  escrowContractAccountId,
  assetTokenId,
  lendingPoolContractAccountId,
} from '../hedera.js';

const mintRwaViaUssdUrl = "https://mintrwaviaussd-cehqwvb4aq-uc.a.run.app";

// Create the context
export const WalletContext = createContext(null);

// Create a provider component
export const WalletProvider = ({ children }) => {
  const [accountId, setAccountId] = useState(null);
  const [evmAddress, setEvmAddress] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [hbarBalance, setHbarBalance] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [flowState, setFlowState] = useState('INITIAL');
  const [nftSerialNumber, setNftSerialNumber] = useState(null);

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

  // On component mount, try to load the wallet from localStorage
  useEffect(() => {
    const storedKey = localStorage.getItem('integro-private-key');
    const storedAccountId = localStorage.getItem('integro-account-id');
    const storedEvmAddress = localStorage.getItem('integro-evm-address');

    if (storedKey && storedAccountId && storedEvmAddress) {
      console.log("WalletContext: Restoring wallet from localStorage.");
      setPrivateKey(storedKey);
      setAccountId(storedAccountId);
      setEvmAddress(storedEvmAddress);
      fetchBalance(storedAccountId);
    }
    setIsLoaded(true);
  }, [fetchBalance]);

  useEffect(() => {
    if (accountId) {
      const interval = setInterval(() => {
        fetchBalance(accountId);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [accountId, fetchBalance]);

  const fetchUserProfile = useCallback(async () => {
    if (!accountId) {
      // If there's no accountId, there's no profile to fetch.
      setIsProfileLoading(false);
      return;
    }
    setIsProfileLoading(true);
    console.log("WalletContext: Fetching user profile for", accountId);
    try {
      const userDocRef = doc(db, 'users', accountId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        console.log("WalletContext: User profile found.");
        setUserProfile(userDocSnap.data());
      } else {
        console.log("WalletContext: User profile not found.");
        setUserProfile(null);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setUserProfile(null);
    } finally {
      setIsProfileLoading(false);
    }
  }, [accountId]);

  // Fetch profile whenever accountId changes.
  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const refreshUserProfile = async () => {
    await fetchUserProfile();
  };

  // This function will be called by the onboarding flow to set the new vault details
  const createVault = (newAccountId, newPrivateKey, newEvmAddress) => {
    console.log("WalletContext: createVault called with", newAccountId);
    // 1. Save to localStorage
    localStorage.setItem('integro-private-key', newPrivateKey);
    localStorage.setItem('integro-account-id', newAccountId);
    localStorage.setItem('integro-evm-address', newEvmAddress);

    // 2. Update state
    console.log("WalletContext: Setting new accountId:", newAccountId);
    setPrivateKey(newPrivateKey);
    setAccountId(newAccountId);
    setEvmAddress(newEvmAddress);
    console.log("WalletContext: State update complete.");
  };

  // This function will allow components to clear the vault
  const logout = () => {
    localStorage.removeItem('integro-private-key');
    localStorage.removeItem('integro-account-id');
    localStorage.removeItem('integro-evm-address');
    setPrivateKey(null);
    setAccountId(null);
    setEvmAddress(null);
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

    const { name, description, price, category, imageUrl } = listingData;

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
    const listTxResponse = await handleList(price, serialNumber);

    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const userAccountId = AccountId.fromString(accountId);
    const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);
    // Wait for the on-chain listing receipt
    const receipt = await listTxResponse.getReceipt(userClient);

    if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error(`On-chain listing failed with status: ${receipt.status.toString()}`);
    }

    // 3. Save to Firestore after on-chain confirmation
    const docId = listingDocId(assetTokenId, serialNumber);
    const priceTinybarsStr = Hbar.from(price).toTinybars().toString();

    await setDoc(doc(db, "listings", docId), {
      tokenId: assetTokenId,
      serialNumber: canonicalSerial(serialNumber),
      name,
      description,
      priceTinybars: priceTinybarsStr, // string canonical
      category,
      sellerAccountId: accountId,
      sellerEvmAddress: evmAddress,
      imageUrl,
      state: "LISTED",
      contractTxId: listTxResponse.transactionId.toString(),
      createdAt: Date.now()
    });

    setFlowState("LISTED");
    return { serialNumber };
  };

  const handleList = async (price, serialToUse) => {
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
    console.log("handleList input types:", { price: typeof price, serialToUse: typeof serialToUse });

    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const userAccountId = AccountId.fromString(accountId);
    const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

    // Step 1: Approve allowance for the escrow contract
    console.log("handleList: Approving NFT allowance...");
    const tokenIdObj = TokenId.fromString(assetTokenId);
    const serialNumberInt = Number(currentSerial);
    console.log("handleList allowance params:", { tokenId: assetTokenId, owner: accountId, spender: escrowContractAccountId, serial: serialNumberInt });

    const allowanceTx = new AccountAllowanceApproveTransaction()
      .approveTokenNftAllowance(tokenIdObj, userAccountId, AccountId.fromString(escrowContractAccountId), [serialNumberInt]);

    const allowanceTxResponse = await allowanceTx.execute(userClient);
    const allowanceReceipt = await allowanceTxResponse.getReceipt(userClient);

    if (allowanceReceipt.status.toString() !== 'SUCCESS') {
      throw new Error(`NFT allowance failed with status: ${allowanceReceipt.status.toString()}`);
    }
    console.log("handleList: NFT allowance approved successfully.");

    // Step 2: List the asset on the contract
    console.log("handleList: Listing asset on escrow contract...");
    const priceInTinybars = Hbar.from(price).toTinybars();
    const serialCanonical = BigInt(String(currentSerial).trim());
    console.log("handleList listAsset params:", { serial: serialCanonical.toString(), priceTinybars: priceInTinybars.toString() });

    const listAssetTx = new ContractExecuteTransaction()
      .setContractId(escrowContractAccountId)
      .setGas(1000000)
      .setFunction("listAsset", new ContractFunctionParameters()
        .addUint256(serialCanonical)
        .addUint256(priceInTinybars)
      );

    const listTxResponse = await listAssetTx.execute(userClient);
    console.log("handleList: On-chain list transaction sent.");

    setFlowState("LISTED");
    return listTxResponse;
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
      const q = query(collection(db, "loans"), where("tokenId", "==", Number(tokenId)));
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

const confirmDelivery = async (listing) => {
  console.log("confirmDelivery: confirming delivery for listing:", listing);
  if (!listing || !listing.serialNumber) {
    throw new Error("Invalid listing passed to confirmDelivery");
  }

  let serialCanonical;
  try {
    serialCanonical = BigInt(String(listing.serialNumber));
  } catch (err) {
    console.error("confirmDelivery: invalid serial number", listing.serialNumber, typeof listing.serialNumber);
    throw new Error("Invalid serial number in listing");
  }
  console.log("confirmDelivery canonical serial:", serialCanonical, typeof serialCanonical);

  const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
  const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
  const userAccountId = AccountId.fromString(accountId);
  const client = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

  const confirmDeliveryTx = new ContractExecuteTransaction()
    .setContractId(escrowContractAccountId)
    .setGas(200000)
    .setFunction("confirmDelivery", new ContractFunctionParameters().addUint256(serialCanonical));

  const txResponse = await confirmDeliveryTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  if (receipt.status.toString() !== "SUCCESS") {
    throw new Error(`confirmDelivery failed with status: ${receipt.status.toString()}`);
  }

  // Update Firestore state atomically
  const docId = listingDocId(assetTokenId, listing.serialNumber);
  await runTransaction(db, async (t) => {
    const docRef = doc(db, "listings", docId);
    const snap = await t.get(docRef);
    if (!snap.exists()) throw new Error("Listing not found for delivery confirmation");

    t.update(docRef, {
      state: "LIQUIDATED", // Or "DELIVERED" depending on final state machine
      settlementTxId: txResponse.transactionId.toString(),
      updatedAt: Date.now(),
    });
  });

  return receipt;
};

  const withdrawPayments = async () => {
    console.log("withdrawPayments: withdrawing payments for account:", accountId);

    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const userAccountId = AccountId.fromString(accountId);
    const client = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

    const withdrawTx = new ContractExecuteTransaction()
      .setContractId(escrowContractAccountId)
      .setGas(200000)
      .setFunction("withdrawPayments", new ContractFunctionParameters());

    const frozenTx = await withdrawTx.freezeWith(client);
    const signedTx = await frozenTx.sign(userPrivateKey);
    const txResponse = await signedTx.execute(client);

    const receipt = await txResponse.getReceipt(client);

    if (receipt.status.toString() !== 'SUCCESS') {
      throw new Error(`Withdraw payments failed with status: ${receipt.status.toString()}`);
    }

    console.log("withdrawPayments: Payments withdrawn successfully.");
    return receipt;
  };

// REPLACE the existing handleBuy with this version
const handleBuy = async (listing) => {
  console.log("DEBUG handleBuy start", { accountId, assetTokenId, nftSerialNumber: listing?.serialNumber });

  // Basic validation & canonicalization
  if (!listing || listing.serialNumber === undefined || listing.serialNumber === null) {
    throw new Error("Invalid listing: missing serialNumber");
  }
  // Ensure serial is numeric string or number -> use BigInt
  let serialCanonical;
  try {
    // Accept string, number, or BigInt
    serialCanonical = BigInt(String(listing.serialNumber).trim());
  } catch (err) {
    console.error("handleBuy: invalid serial number", listing.serialNumber);
    throw new Error("Invalid serial number for listing");
  }

  // Price canonicalization: we expect tinybars as a decimal integer string in listing.priceTinybars
  const priceTinybarsStr = String(listing.priceTinybars || listing.price || "0").trim();
  console.log("handleBuy canonical inputs:", { serial: serialCanonical.toString(), priceTinybars: priceTinybarsStr });
  if (!/^\d+$/.test(priceTinybarsStr)) {
    console.error("handleBuy: priceTinybars is not a numeric string:", priceTinybarsStr, typeof priceTinybarsStr);
    throw new Error("Invalid price for listing");
  }

  if (priceTinybarsStr === "0") {
    throw new Error("Listing has price 0 or is invalid");
  }

  // operator client: use the buyer's account as the client operator
  const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
  const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
  const userAccountId = AccountId.fromString(accountId);
  const client = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

  // Build the contract execute tx and let the SDK sign with the client operator (no manual sign)
  const fundEscrowTx = new ContractExecuteTransaction()
    .setContractId(escrowContractAccountId)
    .setGas(200000)
    .setFunction("fundEscrow", new ContractFunctionParameters().addUint256(serialCanonical))
    .setPayableAmount(Hbar.fromTinybars(priceTinybarsStr)); // Hbar.fromTinybars accepts numeric string

  // Execute (SDK will sign with the client operator)
  const txResponse = await fundEscrowTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  if (receipt.status.toString() !== "SUCCESS") {
    throw new Error(`Funding escrow failed with status: ${receipt.status.toString()}`);
  }

  // Sanity-check on-chain using the same client
  const callQuery = new ContractCallQuery()
    .setContractId(escrowContractAccountId)
    .setGas(200000)
    .setFunction("listings", new ContractFunctionParameters().addUint256(serialCanonical));

  const callResult = await callQuery.execute(client);
  const onchainSeller = callResult.getAddress(0);
  const onchainBuyer = callResult.getAddress(1);
  const onchainPriceTinybars = callResult.getUint256(2).toString();
  const onchainStateNum = Number(callResult.getUint256(3).toString());

  console.log("DEBUG onchainPriceTinybars:", onchainPriceTinybars, "onchainStateNum:", onchainStateNum);

  if (onchainStateNum !== 1) { // ensure your enum mapping: 1 == FUNDED
    console.error("handleBuy: onchain state not FUNDED", onchainStateNum);
    throw new Error("Escrow: on-chain state not set to FUNDED after funding tx");
  }

  // Update Firestore atomically (recommended) -- use a transaction to avoid race conditions
  const docId = listingDocId(assetTokenId, listing.serialNumber);
  await runTransaction(db, async (t) => {
    const docRef = doc(db, "listings", docId);
    const snap = await t.get(docRef);
    if (!snap.exists()) throw new Error("Listing not found during update");

    const currentState = snap.data().state;
    if (currentState && currentState !== "LISTED") {
      throw new Error("Listing state not in expected LISTED state");
    }

    t.update(docRef, {
      state: "FUNDED",
      buyer: accountId,
      paidTinybars: String(onchainPriceTinybars),
      fundTxId: txResponse.transactionId.toString(),
      updatedAt: Date.now(),
    });

    // Create the delivery gig
    const gigRef = doc(collection(db, "gigs")); // auto-generates an ID
    t.set(gigRef, {
      title: `Deliver ${snap.data().name || 'item'} (#${listing.serialNumber})`,
      listingId: docId,
      origin: snap.data().pickupLocation || snap.data().location || "Unknown",
      destination: "Buyer Location", // Placeholder
      rewardTinybars: String(onchainPriceTinybars), // Or a calculated fee
      status: "OPEN",
      createdAt: Timestamp.now(),
      buyerAccountId: accountId,
      sellerAccountId: snap.data().sellerAccountId,
    });
  });

  setFlowState("FUNDED");
  return receipt;
};

  const value = {
    accountId,
    evmAddress,
    privateKey,
    hbarBalance,
    isLoaded,
    userProfile,
    isProfileLoading,
    flowState,
    nftSerialNumber,
    createVault,
    logout,
    refreshUserProfile,
    handleTokenAssociation,
    handleMint,
    handleList,
    handleMintAndList,
    approveNFTForPool,
    callTakeLoan,
    callRepayLoan,
    depositLiquidityAsAdmin,
    liquidateLoanAsAdmin,
    confirmDelivery,
    handleBuy,
    withdrawPayments,
  };
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook to use the wallet context
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
