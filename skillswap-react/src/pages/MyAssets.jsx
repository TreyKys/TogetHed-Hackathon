import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import { db, collection, query, where, getDocs, or } from '../firebase.js';
import BackButton from '../components/BackButton.jsx';
import { assetTokenId } from '../hedera.js';
import './MyAssets.css';

// Function to decode base64 metadata
const decodeMetadata = (base64) => {
    try {
        const json = atob(base64);
        return JSON.parse(json);
    } catch (e) {
        console.error("Failed to parse metadata:", e);
        return {};
    }
};

const MyAssets = () => {
    const { accountId, confirmDelivery, handleWithdraw } = useWallet();
    const [assets, setAssets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [hasPendingWithdrawals, setHasPendingWithdrawals] = useState(false);

    const fetchAssets = async () => {
        if (!accountId) return;
        setIsLoading(true);
        try {
            const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts?token.id=${assetTokenId}`;
            const response = await fetch(mirrorNodeUrl);
            if (!response.ok) throw new Error(`Failed to fetch from mirror node: ${response.statusText}`);
            const data = await response.json();
            const userNfts = data.nfts || [];

            const listingsRef = collection(db, "listings");
            const q = query(listingsRef, or(where("sellerAccountId", "==", accountId), where("buyerAccountId", "==", accountId)));
            const querySnapshot = await getDocs(q);
            const firestoreListings = {};
            querySnapshot.forEach(doc => {
                const docData = doc.data();
                firestoreListings[docData.serialNumber] = { ...docData, id: doc.id };
            });

            const pending = Object.values(firestoreListings).some(listing => listing.sellerAccountId === accountId && listing.paymentPending);
            setHasPendingWithdrawals(pending);

            const ownedAssets = userNfts.map(nft => {
                const metadata = decodeMetadata(nft.metadata);
                const firestoreInfo = firestoreListings[nft.serial_number];
                return {
                    serialNumber: nft.serial_number,
                    name: metadata.name || 'Untitled Asset',
                    description: metadata.description || 'No description.',
                    imageUrl: metadata.image || 'https://via.placeholder.com/150',
                    status: firestoreInfo ? firestoreInfo.status : 'In Wallet',
                    id: firestoreInfo ? firestoreInfo.id : null,
                    paymentPending: firestoreInfo ? firestoreInfo.paymentPending : false,
                };
            });

            const purchasedAssets = Object.values(firestoreListings)
                .filter(listing => listing.buyerAccountId === accountId && !ownedAssets.find(a => a.serialNumber === listing.serialNumber))
                .map(listing => ({ ...listing, status: listing.status }));

            setAssets([...ownedAssets, ...purchasedAssets]);
        } catch (error) {
            console.error("Failed to fetch assets:", error);
            setAssets([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAssets();
    }, [accountId]);

    const handleConfirmDelivery = async (listingId, serialNumber) => {
        try {
            await confirmDelivery(listingId, serialNumber);
            fetchAssets(); // Refresh assets to show new status
        } catch (error) {
            console.error("Failed to confirm delivery:", error);
        }
    };

    const handleWithdrawClick = async () => {
        setIsWithdrawing(true);
        try {
            await handleWithdraw();
            await fetchAssets(); // Refresh assets to update UI
        } catch (error) {
            console.error("Failed to withdraw funds:", error);
        } finally {
            setIsWithdrawing(false);
        }
    };

    return (
        <div className="my-assets-container">
            <BackButton />
            <h2>My Digital Assets</h2>

            {hasPendingWithdrawals && (
                <div className="withdraw-container">
                    <p>You have funds from a sale ready for withdrawal.</p>
                    <button onClick={handleWithdrawClick} disabled={isWithdrawing} className="withdraw-all-btn">
                        {isWithdrawing ? 'Processing...' : 'Withdraw Funds'}
                    </button>
                </div>
            )}

            {isLoading ? (
                <p>Loading your assets from the Hedera network...</p>
            ) : assets.length > 0 ? (
                <div className="assets-grid">
                    {assets.map(asset => (
                        <div key={asset.serialNumber} className="asset-card">
                            <img src={asset.imageUrl} alt={asset.name} className="asset-image" />
                            <div className="asset-info">
                                <h3>{asset.name}</h3>
                                <p className="asset-serial">Serial: {asset.serialNumber}</p>
                                <div className="asset-status-wrapper">
                                    <span className={`status-badge status-${asset.status.toLowerCase().replace(/ /g, '-')}`}>
                                        {asset.status}
                                    </span>
                                    {asset.paymentPending && (
                                        <span className="status-badge status-pending-payment">
                                            Payment Ready
                                        </span>
                                    )}
                                </div>
                                {asset.status === 'Pending Delivery' && (
                                    <button
                                      onClick={() => handleConfirmDelivery(asset.id, asset.serialNumber)}
                                      className="confirm-delivery-btn"
                                    >
                                        Confirm Delivery
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="no-assets-container">
                    <p>You haven't minted or purchased any assets yet.</p>
                    <p>Visit the Marketplace to create or buy your first digital asset.</p>
                </div>
            )}
        </div>
    );
};

export default MyAssets;
