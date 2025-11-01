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
  const { accountId, privateKey, userProfile, isLoaded, isProfileLoading, setFlowState, handleBuy } = useWallet();
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


const handleBuyClick = async (listing) => {
  console.log("handleBuyClick: Initiating purchase for listing:", listing);
  try {
    if (!listing || !listing.serialNumber) throw new Error("Listing missing serial number");

    // Validate serial number
    let serialBig;
    try {
      serialBig = BigInt(String(listing.serialNumber));
    } catch (err) {
      throw new Error("Invalid serial number in listing");
    }

    const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
    const userAccountId = AccountId.fromString(accountId);
    const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

    const callQuery = new ContractCallQuery()
      .setContractId(escrowContractAccountId)
      .setGas(200000)
      .setFunction("listings", new ContractFunctionParameters().addUint256(serialBig));

    const callResult = await callQuery.execute(userClient);
    const priceInTinybarsLong = callResult.getUint256(2);

    if (!priceInTinybarsLong || priceInTinybarsLong.isZero()) {
      throw new Error("This asset is not currently listed for sale or has a price of zero.");
    }

    const priceInTinybars = priceInTinybarsLong.toString();
    console.log("handleBuyClick: Canonical serial:", serialBig, typeof serialBig);
    console.log("handleBuyClick: Converted price (String):", priceInTinybars);

    setSelectedListing({ ...listing, price: priceInTinybars, priceTinybars: priceInTinybars });
    setIsModalOpen(true);
  } catch (error) {
    console.error("handleBuyClick: error preparing purchase:", error);
    setToast({ show: true, message: `Error preparing purchase: ${error.message}` });
  }
};

  const executeBuy = async () => {
    if (!selectedListing) return;

    setIsModalOpen(false);
    setIsTransactionLoading(true);

    try {
      const receipt = await handleBuy(selectedListing);
      setToast({ show: true, message: `Congratulations! You have purchased '${selectedListing.name}'.`, txHash: receipt.transactionId.toString() });
    } catch (error) {
      console.error("executeBuy Error:", error);
      setToast({ show: true, message: `Purchase Failed: ${error.message}` });
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
          priceInHbar={Hbar.fromTinybars(selectedListing.priceInTinybars).toString()}
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
            {listings.filter(l => l.category === activeTab && (l.status === 'Listed' || l.state === 'LISTED')).map(listing => (
              <motion.div key={listing.id} className="listing-card" variants={itemVariants}>
                <img src={listing.imageUrl} alt={listing.name} className="listing-image" />
                <div className="listing-info">
                  <h3>{listing.name}</h3>
                  <p>{listing.description}</p>
                  <div className="listing-footer">
                    <span className="listing-price">{Hbar.fromTinybars(listing.priceTinybars || listing.price || '0').toString()} ℏ</span>
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