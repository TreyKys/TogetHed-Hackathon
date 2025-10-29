import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import Header from '../components/Header.jsx';
import Sidebar from '../components/Sidebar.jsx';
import FlowBadge from '../components/FlowBadge.jsx';
import Toast from '../components/Toast.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';
import './Marketplace.css';
import '../App.css';
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
  escrowContractAccountId,
  assetTokenId,
} from '../hedera.js';

const mintRwaViaUssdUrl = "https://mintrwaviaussd-cehqwvb4aq-uc.a.run.app";

function Marketplace() {
  const {
    accountId,
    privateKey,
    handleMint: contextMint,
    handleList: contextList,
    flowState,
    assetTokenIdState,
    nftSerialNumber
  } = useWallet();
  const [status, setStatus] = useState("Welcome to the Integro Marketplace.");
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Goods & Produce');
  const [toast, setToast] = useState({ show: false, message: '', txHash: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPrice, setModalPrice] = useState({ hbar: 0, tinybars: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    if (accountId) {
        setStatus(`✅ Vault connected. Welcome, ${accountId}`);
    }
  }, [accountId]);

  const handleMint = async () => {
    setIsTransactionLoading(true);
    setStatus("🚀 Minting RWA NFT...");
    try {
      await contextMint("Yam Harvest Future", "Grade A", "Ikorodu, Nigeria");
      setStatus(`✅ NFT Minted! Serial Number: ${nftSerialNumber}`);
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
      const txId = await contextList(50);
      setStatus(`✅ NFT Listed for 50 HBAR!`);
      setToast({ show: true, message: 'NFT Listed Successfully!', txHash: txId });
    } catch (error) {
      console.error("Listing failed:", error);
      setStatus(`❌ Listing Failed: ${error.message}`);
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!accountId || !nftSerialNumber) return alert("No item listed for sale.");

    // Get the price and show the modal
    try {
        const userClient = Client.forTestnet(); // No operator needed for query
        const getPriceQuery = new ContractCallQuery()
            .setContractId(escrowContractAccountId)
            .setGas(100000)
            .setFunction("getListingPrice", new ContractFunctionParameters().addUint256(nftSerialNumber));

        const priceQueryResult = await getPriceQuery.execute(userClient);
        const priceInWei = priceQueryResult.getUint256(0);

        if (priceInWei.isZero()) {
            throw new Error("Could not retrieve a valid price for this NFT.");
        }

        const payableAmount = Hbar.fromTinybars(priceInWei);
        setModalPrice({ hbar: payableAmount.toString(), tinybars: priceInWei.toString() });
        setIsModalOpen(true);

    } catch (error) {
        console.error("Failed to get price:", error);
        setStatus(`❌ Error: ${error.message}`);
    }
  };

  const executeBuy = async () => {
    setIsModalOpen(false);
    setIsTransactionLoading(true);
    setStatus("🚀 Buying NFT (Funding Escrow)...");
    try {
      if (!privateKey) throw new Error('No private key found in context.');

      // Setup client
      const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
      const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
      const userAccountId = AccountId.fromString(accountId);
      const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

      const payableAmount = Hbar.fromTinybars(modalPrice.tinybars);

      const fundTx = new ContractExecuteTransaction()
        .setContractId(escrowContractAccountId)
        .setGas(1000000)
        .setPayableAmount(payableAmount)
        .setFunction("fundEscrow", new ContractFunctionParameters()
          .addUint256(nftSerialNumber)
        );

      const frozenFundTx = await fundTx.freezeWith(userClient);
      const signedFundTx = await frozenFundTx.sign(userPrivateKey);
      const fundTxResponse = await signedFundTx.execute(userClient);
      const fundReceipt = await fundTxResponse.getReceipt(userClient);

      if (fundReceipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Native fundEscrow call failed: ${fundReceipt.status.toString()}`);
      }

      setFlowState("FUNDED");
      setStatus(`✅ Escrow Funded!`);
      setToast({ show: true, message: 'Escrow Funded Successfully!', txHash: fundTxResponse.transactionId.toString() });

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
      if (!privateKey) throw new Error('No private key found in context.');

      // Setup client
      const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
      const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
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
      const signedConfirmTx = await signedConfirmTx.sign(userPrivateKey);
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

  return (
    <div className="marketplace-container">
      <Header onMenuClick={() => setIsSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <FlowBadge flowState={flowState} nftSerialNumber={nftSerialNumber} price={50} />
      {toast.show && <Toast message={toast.message} txHash={toast.txHash} onClose={() => setToast({ show: false, message: '', txHash: '' })} />}
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={executeBuy}
        priceInHbar={modalPrice.hbar}
        priceInTinybars={modalPrice.tinybars}
      />
      <main className="marketplace-content">
        <div className="card">
          <h3>Connection Status</h3>
          <div className={`status-message ${status.includes('✅') ? 'status-success' : 'status-error'}`}>
            {status}
          </div>
        </div>

        <div className="tabs">
            <div className={`tab ${activeTab === 'Goods & Produce' ? 'active' : ''}`} onClick={() => setActiveTab('Goods & Produce')}>
                Goods & Produce
            </div>
            <div className={`tab ${activeTab === 'Services & Gigs' ? 'active' : ''}`} onClick={() => setActiveTab('Services & Gigs')}>
                Services & Gigs
            </div>
            <div className={`tab ${activeTab === 'Post a Job / Request' ? 'active' : ''}`} onClick={() => setActiveTab('Post a Job / Request')}>
                Post a Job / Request
            </div>
        </div>

        <div className="tab-content">
            {activeTab === 'Goods & Produce' && (
                <div>
                    <div className="card">
                        <button onClick={() => navigate('/create-listing')} className="hedera-button">
                            Or sell your own product/service
                        </button>
                    </div>
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
                </div>
            )}
            {activeTab === 'Services & Gigs' && (
                <div className="card">
                    <button onClick={() => navigate('/create-listing')} className="hedera-button">
                        Sell your own product/service
                    </button>
                    <p style={{marginTop: '1rem'}}>Content for Services & Gigs will go here.</p>
                </div>
            )}
            {activeTab === 'Post a Job / Request' && <div>Content for Post a Job / Request will go here.</div>}
        </div>
      </main>
    </div>
  );
}

export default Marketplace;