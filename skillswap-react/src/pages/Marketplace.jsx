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
  const { accountId, privateKey, userProfile, isLoaded, isProfileLoading, setFlowState } = useWallet();
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
      console.log("handleBuyClick: Fetching on-chain price for serial:", listing.serialNumber);
      const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
      const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
      const userAccountId = AccountId.fromString(accountId);
      const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

      const getListingQuery = new ContractCallQuery()
        .setContractId(escrowContractAccountId)
        .setGas(100000)
        .setFunction("listings", new ContractFunctionParameters().addUint256(listing.serialNumber));

      const listingQueryResult = await getListingQuery.execute(userClient);
      // The price is the 3rd element (index 2) in the returned struct
      const priceInTinybarsLong = listingQueryResult.getUint256(2);
      console.log("handleBuyClick: Raw price from contract (Long):", priceInTinybarsLong.toString());

      if (priceInTinybarsLong.isZero()) {
        console.error("handleBuyClick: On-chain price is zero. Aborting.");
        throw new Error("This asset is not currently listed for sale or has a price of zero.");
      }

      const priceInTinybars = priceInTinybarsLong.toNumber();
      console.log("handleBuyClick: Converted price (Number):", priceInTinybars);

      // Set the selected listing with the definitive on-chain price
      setSelectedListing({ ...listing, priceInTinybars });
      setIsModalOpen(true);
      console.log("handleBuyClick: Opening confirmation modal.");

    } catch (error) {
      console.error("handleBuyClick: Error during price fetching:", error);
      setToast({ show: true, message: `Error preparing purchase: ${error.message}` });
    }
  };

  const executeBuy = async () => {
    if (!selectedListing) {
      console.error("executeBuy: Attempted to buy without a selected listing.");
      return;
    }
    console.log("executeBuy: Executing purchase for:", selectedListing);
    setIsModalOpen(false);
    setIsTransactionLoading(true);

    try {
      const rawPrivKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
      const userPrivateKey = PrivateKey.fromStringECDSA(rawPrivKey);
      const userAccountId = AccountId.fromString(accountId);
      const userClient = Client.forTestnet().setOperator(userAccountId, userPrivateKey);

      console.log(`executeBuy: Funding escrow with ${selectedListing.priceInTinybars} tinybars for serial ${selectedListing.serialNumber}`);

      const fundTx = new ContractExecuteTransaction()
        .setContractId(escrowContractAccountId)
        .setGas(1000000)
        .setPayableAmount(Hbar.fromTinybars(selectedListing.priceInTinybars))
        .setFunction("fundEscrow", new ContractFunctionParameters().addUint256(selectedListing.serialNumber));

      const frozenFundTx = await fundTx.freezeWith(userClient);
      const signedFundTx = await frozenFundTx.sign(userPrivateKey);
      const fundTxResponse = await signedFundTx.execute(userClient);
      console.log("executeBuy: Transaction submitted. Waiting for receipt...");
      await fundTxResponse.getReceipt(userClient);
      console.log("executeBuy: Transaction confirmed.");

      // Update Firestore document to 'Pending Delivery'
      console.log("executeBuy: Updating Firestore status to 'Pending Delivery' for listing ID:", selectedListing.id);
      const listingRef = doc(db, 'listings', selectedListing.id);
      await updateDoc(listingRef, {
        status: 'Pending Delivery',
        buyerAccountId: accountId
      });
      console.log("executeBuy: Firestore status updated.");

      setPurchasedItemName(selectedListing.name);
      setFlowState("FUNDED");
      setToast({ show: true, message: `Congratulations! You have purchased '${selectedListing.name}'.`, txHash: fundTxResponse.transactionId.toString() });

    } catch (error) {
      console.error("executeBuy: Full error object:", error);
      let errorMessage = error.message;
      if (error.status) {
         errorMessage = `Transaction failed with status: ${error.status.toString()}`;
      } else if (error.message.includes('insufficient')) {
         errorMessage = 'Insufficient account balance to complete the purchase.';
      }
      setToast({ show: true, message: `Purchase Failed: ${errorMessage}` });
    } finally {
      setIsTransactionLoading(false);
      setSelectedListing(null); // Clear selected listing after the attempt
      console.log("executeBuy: Purchase flow finished.");
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