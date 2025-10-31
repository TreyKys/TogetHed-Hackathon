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
      // 0. sanity
      if (!accountId) throw new Error("No accountId in state");
      const storedKey = localStorage.getItem('integro-private-key');
      if (!storedKey) throw new Error("No private key in localStorage");

      // 1. build buyer client (operator MUST be set)
      const buyerPrivateKey = PrivateKey.fromString(storedKey);
      const buyerAccountId = AccountId.fromString(accountId);
      const client = Client.forTestnet().setOperator(buyerAccountId, buyerPrivateKey);

      // 2. verify serial is present
      if (selectedListing.serialNumber == null) throw new Error("No nftSerialNumber set");

      // 3. read canonical listing on-chain (price stored in tinybars)
      const query = new ContractCallQuery()
        .setContractId(escrowContractAccountId)         // 0.0.x (contract account)
        .setGas(200000)
        .setFunction("listings", new ContractFunctionParameters().addUint256(BigInt(selectedListing.serialNumber)));

      const result = await query.execute(client);

      // Parse listing: seller (0), buyer (1), price (2), state (3)
      const sellerAddr = result.getAddress(0);
      const buyerAddr = result.getAddress(1);
      const priceTinybarsStr = result.getUint256(2).toString(); // IMPORTANT: string
      const stateNum = Number(result.getUint256(3).toString());

      console.log("DEBUG onchain listing:", { sellerAddr, buyerAddr, priceTinybarsStr, stateNum });

      if (stateNum !== 0) throw new Error("Escrow: Asset is not listed for sale.");

      // 4. compute payable amount as Hbar from tinybars (safe)
      const payableHbar = Hbar.fromTinybars(priceTinybarsStr); // accepts string
      console.log("DEBUG payableHbar:", payableHbar.toString());

      // 5. execute fundEscrow contract call
      const tx = await new ContractExecuteTransaction()
        .setContractId(escrowContractAccountId)
        .setGas(300000)
        .setFunction("fundEscrow", new ContractFunctionParameters().addUint256(BigInt(selectedListing.serialNumber)))
        .setPayableAmount(payableHbar)
        .execute(client);

      const receipt = await tx.getReceipt(client);
      console.log("DEBUG fundEscrow receipt:", receipt.status.toString());
      if (receipt.status.toString() !== "SUCCESS") throw new Error("Purchase failed: " + receipt.status.toString());

      const listingRef = doc(db, 'listings', selectedListing.id);
      await updateDoc(listingRef, {
        status: 'Pending Delivery',
        buyerAccountId: accountId
      });

      setPurchasedItemName(selectedListing.name);
      setFlowState("FUNDED");
      setToast({ show: true, message: `Congratulations! You have purchased '${selectedListing.name}'.`, txHash: tx.transactionId.toString() });

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