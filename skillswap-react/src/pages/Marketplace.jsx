import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { db, collection, onSnapshot, query, where } from '../firebase';
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
import { getOnchainListing } from '../hedera_helpers.js';

function Marketplace() {
  const { accountId, privateKey, setFlowState } = useWallet();
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Goods & Produce');
  const [toast, setToast] = useState({ show: false, message: '', txHash: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, "listings"), where("state", "==", "LISTED"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(listingsData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleBuy = async () => {
    if (!selectedListing) return;
    setIsModalOpen(false);
    setIsTransactionLoading(true);

    try {
      const storedKey = privateKey;
      const storedAccountId = accountId;
      if (!storedKey || !storedAccountId) throw new Error("Vault not available.");

      // 1) Check on-chain listing
      const serial = Number(selectedListing.serial);
      const onchain = await getOnchainListing(serial, escrowContractAccountId, storedAccountId, storedKey);
      if (!onchain || Number(onchain.state) !== 0) {
        throw new Error("Escrow: Asset is not listed for sale.");
      }
      const priceTinybars = BigInt(onchain.price); // canonical price

      // 2) Create client with buyer operator and call fundEscrow
      const client = Client.forTestnet().setOperator(AccountId.fromString(storedAccountId), PrivateKey.fromStringECDSA(storedKey.startsWith("0x") ? storedKey.slice(2) : storedKey));
      const tx = await new ContractExecuteTransaction()
        .setContractId(escrowContractAccountId)
        .setGas(200000)
        .setFunction("fundEscrow", new ContractFunctionParameters().addUint256(BigInt(serial)))
        .setPayableAmount(Hbar.fromTinybars(priceTinybars))
        .execute(client);

      const receipt = await tx.getReceipt(client);
      if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Purchase failed with status ${receipt.status.toString()}`);
      }

      // 4) Update Firestore listing doc -> state: FUNDED buyer: storedAccountId
      await updateDoc(doc(db, "listings", selectedListing.id), {
        state: "FUNDED",
        buyerAccountId: storedAccountId,
        fundedTxId: receipt.transactionId?.toString() || null,
        fundedAt: new Date().toISOString()
      });


      setFlowState("FUNDED");
      setToast({ show: true, message: 'Escrow Funded Successfully!', txHash: receipt.transactionId.toString() });
    } catch (err) {
      console.error("Purchase failed:", err);
      setToast({ show: true, message: `❌ Purchase Failed: ${err.message}` });
    } finally {
      setIsTransactionLoading(false);
    }
  };

  const handleBuyClick = (listing) => {
    setSelectedListing(listing);
    setIsModalOpen(true);
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
          onConfirm={handleBuy}
          priceInHbar={Hbar.fromTinybars(selectedListing.priceTinybars).toString()}
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
                    <span className="listing-price">{Hbar.fromTinybars(listing.priceTinybars).toString()} ℏ</span>
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