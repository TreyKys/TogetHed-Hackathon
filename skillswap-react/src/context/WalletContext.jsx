import React, { createContext, useState, useEffect, useContext } from 'react';
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
  assetTokenId,
} from '../hedera.js';

const mintRwaViaUssdUrl = "https://mintrwaviaussd-cehqwvb4aq-uc.a.run.app";

// Create the context
export const WalletContext = createContext(null);

// Create a provider component
export const WalletProvider = ({ children }) => {
  const [accountId, setAccountId] = useState(null);
  const [evmAddress, setEvmAddress] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false); // To track if we've checked localStorage
  const [flowState, setFlowState] = useState('INITIAL');
  const [assetTokenIdState, setAssetTokenIdState] = useState(null);
  const [nftSerialNumber, setNftSerialNumber] = useState(null);

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
    }
    setIsLoaded(true); // Mark as loaded even if no wallet was found
  }, []);

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
    if (!response.ok) {
      throw new Error(data.error || 'Backend minting request failed.');
    }

    const { tokenId: receivedTokenId, serialNumber } = data;
    setAssetTokenIdState(receivedTokenId);
    setNftSerialNumber(serialNumber);
    setFlowState('MINTED');
    return serialNumber;
  };

  const handleList = async (price) => {
    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const userAccountId = AccountId.fromString(accountId);
    const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

    const tokenIdObj = TokenId.fromString(assetTokenIdState);
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

  const value = {
    accountId,
    evmAddress,
    privateKey,
    isLoaded,
    flowState,
    assetTokenIdState,
    nftSerialNumber,
    createVault,
    logout,
    handleTokenAssociation,
    handleMint,
    handleList
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
