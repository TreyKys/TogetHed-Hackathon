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
import { db, collection, addDoc, Timestamp, doc, getDoc, query, where, getDocs, updateDoc } from '../firebase';
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
    if (accountId) {
      console.log("WalletContext: Fetching user profile for", accountId);
      const userDocRef = doc(db, 'users', accountId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        console.log("WalletContext: User profile found.");
        setUserProfile(userDocSnap.data());
      } else {
        console.log("WalletContext: User profile not found.");
        setUserProfile(null);
      }
    }
  }, [accountId]);

  // On component mount, try to load the wallet from localStorage
  useEffect(() => {
    fetchUserProfile();
  }, [accountId, fetchUserProfile]);

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
    await handleList(price, serialNumber);

    // 3. Save to Firestore
    await addDoc(collection(db, "listings"), {
      tokenId: assetTokenId,
      serialNumber: Number(serialNumber),
      name,
      description,
      price: Hbar.from(price).toTinybars().toString(),
      category,
      sellerAccountId: accountId,
      sellerEvmAddress: evmAddress,
      imageUrl,
      createdAt: Timestamp.now(),
    });

    return { serialNumber };
  };

  const handleList = async (price, serialToUse) => {
    const currentSerial = serialToUse || nftSerialNumber;
    // --- Defensive Programming: Check for null values ---
    if (!assetTokenId) {
      console.error("handleList Error: assetTokenId is not set. Please check hedera.js");
      throw new Error("Configuration error: assetTokenId is missing.");
    }
    if (nftSerialNumber === null || nftSerialNumber === undefined) {
      console.error("handleList Error: nftSerialNumber is not set. Minting may have failed.");
      throw new Error("State error: nftSerialNumber is missing.");
    }
    console.log(`handleList: Listing NFT ${assetTokenId} - Serial: ${currentSerial} for price: ${price}`);

    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const userAccountId = AccountId.fromString(accountId);
    const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

    const tokenIdObj = TokenId.fromString(assetTokenId);
    const nftIdObj = new NftId(tokenIdObj, Number(nftSerialNumber));

    const allowanceTx = new AccountAllowanceApproveTransaction()
      .approveTokenNftAllowance(nftIdObj, userAccountId, escrowContractAccountId);

    const frozenTx = await allowanceTx.freezeWith(userClient);
    const signedTx = await frozenTx.sign(userPrivateKey);
    const txResponse = await signedTx.execute(userClient);
    await txResponse.getReceipt(userClient);

    const priceInWei = Hbar.from(price).toTinybars();
    const listAssetTx = new ContractExecuteTransaction()
      .setContractId(escrowContractAccountId)
      .setGas(1000000)
      .setFunction("listAsset", new ContractFunctionParameters()
        .addUint256(nftSerialNumber)
        .addUint256(priceInWei)
      );

    const frozenListTx = await listAssetTx.freezeWith(userClient);
    const signedListTx = await frozenListTx.sign(userPrivateKey);
    const listTxResponse = await signedListTx.execute(userClient);
    await listTxResponse.getReceipt(userClient);

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

  const value = {
    accountId,
    evmAddress,
    privateKey,
    hbarBalance,
    isLoaded,
    userProfile,
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
    liquidateLoanAsAdmin
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
