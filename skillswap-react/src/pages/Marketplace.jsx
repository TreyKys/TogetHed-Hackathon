import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { db, collection, onSnapshot } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import Toast from '../components/Toast.jsx';
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
  const { accountId, handleBuy: purchaseAsset, userProfile, isLoaded, isProfileLoading } = useWallet();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Goods & Produce');
  const [toast, setToast] = useState({ show: false, message: '', txHash: '' });
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isProfileLoading && (!userProfile || !userProfile.profileCompleted)) {
      setToast({ show: true, message: 'Please complete your profile to create listings.' });
    }
  }, [isProfileLoading, userProfile]);

  useEffect(() => {
    console.log("Marketplace useEffect triggered");
    const listingsRef = collection(db, 'listings');
    const unsubscribe = onSnapshot(listingsRef, (snapshot) => {
      const listingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("Listings data:", listingsData);
      setListings(listingsData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleBuyClick = async (listing) => {
    setIsTransactionLoading(true);
    try {
      const txResponse = await purchaseAsset(listing);
      setToast({
        show: true,
        message: `Congratulations! You have purchased '${listing.name}'.`,
        txHash: txResponse.transactionId.toString(),
      });
    } catch (error) {
      console.error("handleBuyClick: Full error object:", error);
      let errorMessage = error.message;
      if (error.status) {
        errorMessage = `Transaction failed with status: ${error.status.toString()}`;
      } else if (error.message.includes('insufficient')) {
        errorMessage = 'Insufficient account balance to complete the purchase.';
      }
      setToast({ show: true, message: `Purchase Failed: ${errorMessage}` });
    } finally {
      setIsTransactionLoading(false);
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