import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { db, collection, onSnapshot } from '../firebase';
import ProfileSetupModal from './ProfileSetupModal.jsx';
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
  const { accountId, privateKey, userProfile, setFlowState } = useWallet();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Goods & Produce');
  const [toast, setToast] = useState({ show: false, message: '', txHash: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const listingsRef = collection(db, 'listings');
    const unsubscribe = onSnapshot(listingsRef, (snapshot) => {
      const listingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(listingsData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Show the profile modal if the user is loaded and doesn't have a profile
    if (userProfile === null) {
      setShowProfileModal(true);
    }
  }, [userProfile]);

  const handleProfileComplete = () => {
    setShowProfileModal(false);
  };

  const handleBuyClick = async (listing) => {
    try {
      const userClient = Client.forTestnet();
      const getPriceQuery = new ContractCallQuery()
        .setContractId(escrowContractAccountId)
        .setGas(100000)
        .setFunction("getListingPrice", new ContractFunctionParameters().addUint256(listing.serialNumber));

      const priceQueryResult = await getPriceQuery.execute(userClient);
      const priceInTinybars = priceQueryResult.getUint256(0);

      if (priceInTinybars.isZero()) {
        throw new Error("Could not retrieve a valid price for this NFT.");
      }

      setSelectedListing({ ...listing, priceInTinybars });
      setIsModalOpen(true);

    } catch (error) {
      console.error("Failed to get price:", error);
      setToast({ show: true, message: `Error fetching price: ${error.message}` });
    }
  };

  const executeBuy = async () => {
    if (!selectedListing) return;
    setIsModalOpen(false);
    setIsTransactionLoading(true);

    try {
      const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
      const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
      const userAccountId = AccountId.fromString(accountId);
      const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

      const fundTx = new ContractExecuteTransaction()
        .setContractId(escrowContractAccountId)
        .setGas(1000000)
        .setPayableAmount(Hbar.fromTinybars(selectedListing.priceInTinybars))
        .setFunction("fundEscrow", new ContractFunctionParameters().addUint256(selectedListing.serialNumber));

      const frozenFundTx = await fundTx.freezeWith(userClient);
      const signedFundTx = await frozenFundTx.sign(userPrivateKey);
      const fundTxResponse = await signedFundTx.execute(userClient);
      await fundTxResponse.getReceipt(userClient);

      // Update Firestore document
      const listingRef = doc(db, 'listings', selectedListing.id);
      await updateDoc(listingRef, { status: 'Pending Delivery' });

      setFlowState("FUNDED");
      setToast({ show: true, message: 'Escrow Funded Successfully!', txHash: fundTxResponse.transactionId.toString() });

    } catch (error) {
      console.error("Purchase failed:", error);
      setToast({ show: true, message: `Purchase Failed: ${error.message}` });
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
      {showProfileModal && <ProfileSetupModal onProfileComplete={handleProfileComplete} />}
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

        {isLoading ? (
          <p>Loading listings...</p>
        ) : (
          <motion.div
            className="listings-grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {listings.filter(l => l.category === activeTab).map(listing => (
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