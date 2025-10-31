import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { db, collection, onSnapshot } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import Toast from '../components/Toast.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';
import './Marketplace.css';
import '../App.css';
import {
  PrivateKey,
  AccountId,
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractCallQuery,
  Hbar
} from '@hashgraph/sdk';
import { escrowContractAccountId } from '../hedera.js';

function Marketplace() {
  const { accountId, privateKey, userProfile, isLoaded, isProfileLoading, setFlowState, readListingOnchain } = useWallet();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Goods & Produce');
  const [toast, setToast] = useState({ show: false, message: '', txHash: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [purchasedItemName, setPurchasedItemName] = useState('');
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isProfileLoading && userProfile === null) {
      setToast({ show: true, message: 'Please complete your profile to create listings.' });
    }
  }, [isProfileLoading, userProfile]);

  useEffect(() => {
    const listingsRef = collection(db, 'listings');
    const unsubscribe = onSnapshot(listingsRef, (snapshot) => {
      const listingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(listingsData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);


  const handleBuyClick = (listing) => {
    setSelectedListing(listing);
    setIsModalOpen(true);
  };

  const executeBuy = async () => {
    if (!selectedListing) return;
    setIsModalOpen(false);
    setIsTransactionLoading(true);

    try {
      // 1) Build client with operator (CRITICAL)
      const buyerPrivateKey = PrivateKey.fromString(privateKey);
      const buyerAccount = AccountId.fromString(accountId);
      const client = Client.forTestnet().setOperator(buyerAccount, buyerPrivateKey);

      // 2) Read the canonical on-chain listing
      const listing = await readListingOnchain(client, escrowContractAccountId, selectedListing.serialNumber);
      console.log("ONCHAIN LISTING:", listing);

      if (listing.stateNum !== 0) { // 0 = LISTED
        throw new Error("Escrow: Asset is not listed for sale.");
      }

      // 3) Convert priceTinybars -> Hbar for SDK .setPayableAmount
      const payableHbar = Hbar.fromTinybars(listing.priceTinybarsStr);

      // Defensive logging
      console.log("DEBUG: buyerAccount:", buyerAccount.toString());
      console.log("DEBUG: signer/key present:", !!privateKey);
      console.log("DEBUG: nftSerialNumber (primitive):", selectedListing.serialNumber, typeof selectedListing.serialNumber);
      console.log("DEBUG: listing.priceTinybarsStr:", listing.priceTinybarsStr);
      console.log("DEBUG: listing.stateNum:", listing.stateNum);
      console.log("DEBUG: payableHbar.toString():", payableHbar.toString());

      // 4) Build ContractExecuteTransaction using Hedera SDK
      const tx = await new ContractExecuteTransaction()
        .setContractId(escrowContractAccountId)
        .setGas(300000)
        .setFunction("fundEscrow", new ContractFunctionParameters().addUint256(BigInt(selectedListing.serialNumber)))
        .setPayableAmount(payableHbar)
        .execute(client);

      console.log("DEBUG: fundEscrow tx id:", tx.transactionId.toString());
      const receipt = await tx.getReceipt(client);
      console.log("DEBUG: fundEscrow receipt status:", receipt.status.toString());

      if (receipt.status.toString() !== "SUCCESS") {
        throw new Error(`Purchase failed, receipt status: ${receipt.status.toString()}`);
      }

      // Update Firestore document to 'Pending Delivery'
      const listingRef = doc(db, 'listings', selectedListing.id);
      await updateDoc(listingRef, {
        status: 'Pending Delivery',
        buyerAccountId: accountId
      });

      setPurchasedItemName(selectedListing.name);
      setFlowState("FUNDED");
      setToast({ show: true, message: `Congratulations! You have purchased '${selectedListing.name}'.`, txHash: tx.transactionId.toString() });

    } catch (err) {
      console.error("Buy failed, debug object:", err);
      setToast({ show: true, message: `Purchase Failed: ${err.message}` });
    } finally {
      setIsTransactionLoading(false);
      setSelectedListing(null);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="marketplace-container">
      {toast.show && <Toast message={toast.message} txHash={toast.txHash} onClose={() => setToast({ show: false, message: '', txHash: '' })} />}
      {selectedListing && (
        <ConfirmationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={executeBuy}
          priceInHbar={Hbar.fromTinybars(selectedListing.price).toString()}
        />
      )}
      <main className="marketplace-content">
        <div className="marketplace-header">
          <h1>Live Marketplace</h1>
          <button onClick={() => navigate('/create-listing')} className="sell-button">
            Sell your product/service
          </button>
        </div>

        <div className="tabs">
          {['Goods & Produce', 'Services & Gigs', 'Jobs & Requests'].map(tab => (
            <div key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab}
            </div>
          ))}
        </div>

        {isProfileLoading ? (
          <p>Loading profile...</p>
        ) : isLoading ? (
          <p>Loading listings...</p>
        ) : (
          <motion.div
            className="listings-grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {listings.filter(l => l.category === activeTab && l.status === 'Listed').map(listing => (
              <motion.div key={listing.id} className="listing-card" variants={itemVariants}>
                <img src={listing.imageUrl} alt={listing.name} className="listing-image" />
                <div className="listing-info">
                  <h3>{listing.name}</h3>
                  <p>{listing.description}</p>
                  <div className="listing-footer">
                    <span className="listing-price">{Hbar.fromTinybars(listing.price).toString()} ℏ</span>
                    <button onClick={() => handleBuyClick(listing)} className="buy-button" disabled={isTransactionLoading}>
                      Buy Now
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default Marketplace;